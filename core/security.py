"""
Middlewares y utilidades de Ciberseguridad Backend:
1. RateLimitMiddleware (5 req/min en login con backoff exponencial; 120 req/min en API general).
2. StrictCORSMiddleware (Orígenes estrictos autorizados, prohibido '*').
3. SecurityHeadersMiddleware (HSTS, CSP, X-Frame-Options, X-Content-Type-Options, X-XSS-Protection).
4. SessionSecurityMiddleware (Rotación anti-fixation, Idle Timeout 30-45m, Absolute Timeout 8-12h y revocación centralizada).
"""

import time
from datetime import timedelta
from django.conf import settings
from django.core.cache import cache
from django.http import JsonResponse
from django.utils import timezone


def get_client_ip(request) -> str:
    x_forwarded_for = request.META.get("HTTP_X_FORWARDED_FOR")
    if x_forwarded_for:
        return x_forwarded_for.split(",")[0].strip()
    x_real_ip = request.META.get("HTTP_X_REAL_IP")
    if x_real_ip:
        return x_real_ip.strip()
    return request.META.get("REMOTE_ADDR", "0.0.0.0")


class RateLimitMiddleware:
    """
    Rate Limiting granular por IP y por usuario:
    - /api/auth/login: Máx 5 intentos/minuto por IP con bloqueo exponencial anti fuerza bruta.
    - /api/* (consulta general): 120 req/min por IP/usuario.
    """

    def __init__(self, get_response):
        self.get_response = get_response
        self.login_limit = getattr(settings, "RATE_LIMIT_LOGIN_PER_MIN", 5)
        self.general_limit = getattr(settings, "RATE_LIMIT_GENERAL_PER_MIN", 120)

    def __call__(self, request):
        path = request.path
        if path.startswith("/api/"):
            ip = get_client_ip(request)
            now = int(time.time())

            # 1. Protección estricta en endpoint de Login
            if path.rstrip("/") == "/api/auth/login" and request.method == "POST":
                lock_key = f"rl:login:lock:{ip}"
                lock_until = cache.get(lock_key)
                if lock_until and now < lock_until:
                    retry_after = int(lock_until - now)
                    resp = JsonResponse(
                        {
                            "error": f"Demasiados intentos de inicio de sesión. Bloqueado temporalmente por {retry_after} segundos."
                        },
                        status=429,
                    )
                    resp["Retry-After"] = str(retry_after)
                    return resp

                window_key = f"rl:login:cnt:{ip}:{now // 60}"
                count = cache.get(window_key, 0) + 1
                cache.set(window_key, count, timeout=90)

                if count > self.login_limit:
                    strike_key = f"rl:login:strikes:{ip}"
                    strikes = cache.get(strike_key, 0) + 1
                    cache.set(strike_key, strikes, timeout=3600)
                    # Bloqueo exponencial: 60s, 120s, 240s, 480s...
                    lock_duration = 60 * (2 ** min(strikes - 1, 5))
                    cache.set(lock_key, now + lock_duration, timeout=lock_duration + 10)
                    resp = JsonResponse(
                        {
                            "error": f"Límite de intentos excedido (máx {self.login_limit}/min). Bloqueo activo por {lock_duration}s."
                        },
                        status=429,
                    )
                    resp["Retry-After"] = str(lock_duration)
                    return resp

            # 2. Rate limiting en endpoints generales de API
            else:
                user_ident = "anon"
                if hasattr(request, "session"):
                    user_ident = request.session.get("active_user_email", "anon")
                gen_key = f"rl:api:{ip}:{user_ident}:{now // 60}"
                count = cache.get(gen_key, 0) + 1
                cache.set(gen_key, count, timeout=70)
                if count > self.general_limit:
                    resp = JsonResponse(
                        {"error": "Límite de peticiones por minuto excedido. Intente nuevamente en unos segundos."},
                        status=429,
                    )
                    resp["Retry-After"] = "60"
                    return resp

        return self.get_response(request)


class StrictCORSMiddleware:
    """
    CORS estricto restringido únicamente a los dominios autorizados de la empresa.
    Elimina cualquier uso de allow_origins=['*'].
    """

    def __init__(self, get_response):
        self.get_response = get_response

    def __call__(self, request):
        origin = request.META.get("HTTP_ORIGIN")
        allowed_origins = set(getattr(settings, "CORS_ALLOWED_ORIGINS", []))

        if origin:
            # Permitir mismo host (same-origin) o dominios explícitamente autorizados
            host_scheme_origin = f"{request.scheme}://{request.get_host()}"
            is_allowed = (origin in allowed_origins) or (origin == host_scheme_origin)

            if request.method == "OPTIONS":
                if not is_allowed:
                    return JsonResponse({"error": "Origen CORS no autorizado."}, status=403)
                response = JsonResponse({"status": "ok"}, status=200)
                response["Access-Control-Allow-Origin"] = origin
                response["Access-Control-Allow-Credentials"] = "true"
                response["Access-Control-Allow-Methods"] = "GET, POST, PUT, DELETE, OPTIONS"
                response["Access-Control-Allow-Headers"] = "Content-Type, X-CSRFToken, Authorization"
                response["Access-Control-Max-Age"] = "86400"
                response["Vary"] = "Origin"
                return response

            if not is_allowed and request.path.startswith("/api/"):
                return JsonResponse({"error": "Origen CORS no autorizado."}, status=403)

            response = self.get_response(request)
            if is_allowed:
                response["Access-Control-Allow-Origin"] = origin
                response["Access-Control-Allow-Credentials"] = "true"
                response["Vary"] = "Origin"
            return response

        return self.get_response(request)


class SecurityHeadersMiddleware:
    """
    Inyecta cabeceras de seguridad HTTP estrictas en cada respuesta.
    """

    def __init__(self, get_response):
        self.get_response = get_response

    def __call__(self, request):
        response = self.get_response(request)

        response["X-Content-Type-Options"] = "nosniff"
        response["X-Frame-Options"] = getattr(settings, "X_FRAME_OPTIONS", "DENY")
        response["X-XSS-Protection"] = "1; mode=block"
        response["Strict-Transport-Security"] = "max-age=31536000; includeSubDomains"

        if request.path.startswith("/api/"):
            response["Content-Security-Policy"] = "default-src 'self'; frame-ancestors 'none'"
        else:
            response["Content-Security-Policy"] = getattr(
                settings,
                "CONTENT_SECURITY_POLICY",
                "default-src 'self'",
            )

        return response


class SessionSecurityMiddleware:
    """
    Control de sesiones centralizadas con doble expiración:
    - Idle Timeout (30-45 min de inactividad).
    - Absolute Timeout (8-12 horas desde el login).
    - Verificación de revocación inmediata en PostgreSQL / Cache.
    """

    def __init__(self, get_response):
        self.get_response = get_response
        self.idle_timeout = getattr(settings, "SESSION_IDLE_TIMEOUT", 2700)          # 45 min
        self.absolute_timeout = getattr(settings, "SESSION_ABSOLUTE_TIMEOUT", 43200) # 12 horas

    def __call__(self, request):
        if hasattr(request, "session") and request.session.get("active_user_email"):
            now_ts = int(time.time())
            created_ts = request.session.get("session_created_at")
            last_act_ts = request.session.get("session_last_activity")
            session_key = request.session.session_key

            # 1. Validar Absolute Timeout (8-12h)
            if created_ts and (now_ts - int(created_ts)) > self.absolute_timeout:
                invalidate_session(request)
                if request.path.startswith("/api/"):
                    return JsonResponse(
                        {"error": "Sesión expirada por tiempo máximo (Absolute Timeout). Inicie sesión nuevamente."},
                        status=401,
                    )

            # 2. Validar Idle Timeout (30-45m)
            elif last_act_ts and (now_ts - int(last_act_ts)) > self.idle_timeout:
                invalidate_session(request)
                if request.path.startswith("/api/"):
                    return JsonResponse(
                        {"error": "Sesión cerrada por inactividad (Idle Timeout)."},
                        status=401,
                    )

            # 3. Validar si la sesión fue revocada centralizadamente
            elif session_key:
                if is_session_revoked(session_key):
                    request.session.flush()
                    if request.path.startswith("/api/"):
                        return JsonResponse(
                            {"error": "La sesión ha sido revocada por seguridad."},
                            status=401,
                        )
                else:
                    # Actualizar marca de actividad
                    request.session["session_last_activity"] = now_ts
                    touch_active_session(session_key, now_ts)

        return self.get_response(request)


def register_authenticated_session(request, user_id: str) -> str:
    """
    Regenera obligatoriamente el session_id tras autenticación exitosa o cambio de privilegios
    (prevención de Session Fixation), invalida la sesión previa y registra la nueva en PostgreSQL.
    """
    from inventario.models import ActiveSession

    old_session_key = request.session.session_key
    if old_session_key:
        try:
            ActiveSession.objects.filter(session_key=old_session_key).delete()
            cache.delete(f"sess:revoked:{old_session_key}")
        except Exception:
            pass

    # Rotar el session_id e invalidar el anterior en el backend de sesiones de Django
    request.session.cycle_key()

    now_ts = int(time.time())
    request.session["active_user_email"] = user_id
    request.session["session_created_at"] = now_ts
    request.session["session_last_activity"] = now_ts
    request.session.save()

    new_key = request.session.session_key
    abs_timeout = getattr(settings, "SESSION_ABSOLUTE_TIMEOUT", 43200)
    now_dt = timezone.now()

    try:
        ActiveSession.objects.update_or_create(
            session_key=new_key,
            defaults={
                "user_id": user_id,
                "ip_address": get_client_ip(request)[:64],
                "user_agent": (request.META.get("HTTP_USER_AGENT") or "")[:512],
                "created_at": now_dt,
                "last_activity": now_dt,
                "expires_at": now_dt + timedelta(seconds=abs_timeout),
                "is_revoked": False,
            },
        )
        cache.set(f"sess:revoked:{new_key}", False, timeout=abs_timeout)
    except Exception:
        pass

    return new_key


def invalidate_session(request) -> None:
    """
    Invalida la sesión actual tanto en la tabla ActiveSession como en el almacén de Django.
    """
    from inventario.models import ActiveSession

    session_key = getattr(request.session, "session_key", None)
    if session_key:
        try:
            ActiveSession.objects.filter(session_key=session_key).update(is_revoked=True)
            cache.set(f"sess:revoked:{session_key}", True, timeout=3600)
        except Exception:
            pass
    request.session.flush()


def is_session_revoked(session_key: str) -> bool:
    cached = cache.get(f"sess:revoked:{session_key}")
    if cached is not None:
        return bool(cached)
    try:
        from inventario.models import ActiveSession
        rec = ActiveSession.objects.filter(session_key=session_key).only("is_revoked", "expires_at").first()
        if rec:
            revoked = rec.is_revoked or (rec.expires_at < timezone.now())
            cache.set(f"sess:revoked:{session_key}", revoked, timeout=300)
            return revoked
    except Exception:
        pass
    return False


def touch_active_session(session_key: str, now_ts: int) -> None:
    """
    Actualiza last_activity en PostgreSQL máximo una vez cada 60s por sesión
    para evitar escrituras excesivas en cada request.
    """
    throttle_key = f"sess:touch:{session_key}"
    if cache.get(throttle_key):
        return
    cache.set(throttle_key, now_ts, timeout=60)
    try:
        from inventario.models import ActiveSession
        ActiveSession.objects.filter(session_key=session_key, is_revoked=False).update(
            last_activity=timezone.now()
        )
    except Exception:
        pass


def revoke_user_sessions(user_id: str, exclude_session_key: str = None) -> int:
    """
    Revoca inmediatamente todas las sesiones activas de un usuario en PostgreSQL y Django Sessions.
    """
    from django.contrib.sessions.models import Session
    from inventario.models import ActiveSession

    qs = ActiveSession.objects.filter(user_id__iexact=user_id, is_revoked=False)
    if exclude_session_key:
        qs = qs.exclude(session_key=exclude_session_key)

    keys = list(qs.values_list("session_key", flat=True))
    count = qs.update(is_revoked=True)

    if keys:
        Session.objects.filter(session_key__in=keys).delete()
        for k in keys:
            cache.set(f"sess:revoked:{k}", True, timeout=43200)

    return count
