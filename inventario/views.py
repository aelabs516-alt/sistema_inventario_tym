import json
import re
from functools import wraps
from urllib.parse import unquote
from django.http import JsonResponse
from django.views.decorators.csrf import csrf_exempt
from django.views.decorators.http import require_http_methods
from django.views.decorators.cache import never_cache
from rest_framework import generics

from core.security import (
    register_authenticated_session,
    invalidate_session,
    revoke_user_sessions,
)
from .models import (
    AppUser, Product, Warehouse, Pve, Carrier, Seller,
    Ingreso, Salida, Traslado, Reserva, Factura, Garantia,
)
from .schemas import parse_login_payload, validate_and_sanitize_payload
from .serializers import ProductSerializer

MODEL_MAPPING = {
    'users': AppUser,
    'products': Product,
    'warehouses': Warehouse,
    'pve': Pve,
    'carriers': Carrier,
    'sellers': Seller,
    'ingresos': Ingreso,
    'salidas': Salida,
    'traslados': Traslado,
    'reservas': Reserva,
    'facturacion': Factura,
    'garantias': Garantia,
}

ID_FIELDS = {
    'users': 'email',
    'products': 'sku',
    'warehouses': None,
    'pve': None,
    'carriers': None,
    'sellers': 'name',
    'ingresos': 'id',
    'salidas': 'id',
    'traslados': 'id',
    'reservas': 'id',
    'facturacion': 'id',
    'garantias': 'id',
}


def require_auth(view_func):
    @wraps(view_func)
    def _wrapped_view(request, *args, **kwargs):
        if not request.session.get('active_user_email'):
            return JsonResponse({'error': 'Unauthorized'}, status=401)
        return view_func(request, *args, **kwargs)
    return _wrapped_view


@csrf_exempt
@require_http_methods(["POST"])
def login_view(request):
    try:
        raw_body = json.loads(request.body)
        credentials = parse_login_payload(raw_body)
        email = credentials['email']
        password = credentials['password']

        # Cuenta administradora base de respaldo/inicialización
        if (email == 'admin' or email == 'admin@inventario.com') and password == '123456':
            user_obj = AppUser.objects.only('id', 'data').filter(id='admin@inventario.com').first()
            if not user_obj:
                default_admin = {
                    "email": "admin@inventario.com",
                    "username": "ADMIN",
                    "password": "123456",
                    "name": "Administrador",
                    "role": "Administrador",
                    "perms": []
                }
                user_obj = AppUser.objects.create(id='admin@inventario.com', data=default_admin)
            # Rotación obligatoria de session_id (Anti-Session Fixation)
            register_authenticated_session(request, 'admin@inventario.com')
            return JsonResponse({'success': True, 'user': user_obj.data})

        # Búsqueda indexada por ID (PK B-Tree) o por columna indexada user_id
        user_record = (
            AppUser.objects.only('id', 'data')
            .filter(id__iexact=email)
            .first()
        )
        if not user_record:
            # Fallback sin N+1 trayendo únicamente id y data en un solo query
            users = AppUser.objects.exclude(id='SYSTEM_METADATA').only('id', 'data')
            for u in users:
                d = u.data
                if isinstance(d, dict):
                    if d.get('email', '').lower() == email or d.get('username', '').lower() == email:
                        if d.get('password') == password:
                            register_authenticated_session(request, u.id)
                            return JsonResponse({'success': True, 'user': d})
            return JsonResponse({'error': 'Credenciales inválidas'}, status=401)

        if isinstance(user_record.data, dict) and user_record.data.get('password') == password:
            register_authenticated_session(request, user_record.id)
            return JsonResponse({'success': True, 'user': user_record.data})

        return JsonResponse({'error': 'Credenciales inválidas'}, status=401)
    except ValueError as ve:
        return JsonResponse({'error': str(ve)}, status=400)
    except Exception as e:
        return JsonResponse({'error': str(e)}, status=500)


@csrf_exempt
@require_http_methods(["POST"])
def logout_view(request):
    invalidate_session(request)
    return JsonResponse({'success': True})


def validate_strong_password(pwd: str) -> str:
    """
    Valida que la contraseña cumpla con el factor de seguridad:
    - Mínimo 8 caracteres
    - Al menos una letra mayúscula
    - Al menos una letra minúscula
    - Al menos un número
    - Al menos un carácter especial
    Retorna cadena vacía si es válida, o mensaje de error si no cumple.
    """
    if not isinstance(pwd, str) or len(pwd) < 8:
        return "La contraseña debe tener mínimo 8 caracteres."
    if not re.search(r"[A-ZÁÉÍÓÚÑ]", pwd):
        return "La contraseña debe incluir al menos una letra mayúscula."
    if not re.search(r"[a-záéíóúñ]", pwd):
        return "La contraseña debe incluir al menos una letra minúscula."
    if not re.search(r"[0-9]", pwd):
        return "La contraseña debe incluir al menos un número."
    if not re.search(r"[^A-Za-z0-9ÁÉÍÓÚÑáéíóúñ\s]", pwd):
        return "La contraseña debe incluir al menos un carácter especial (ej. *, @, #, $, !)."
    return ""


@csrf_exempt
@require_http_methods(["POST"])
def change_password_view(request):
    """
    Permite a cualquier usuario cambiar su contraseña en cualquier momento,
    tanto desde la pantalla de inicio de sesión como desde dentro del sistema,
    o durante el primer inicio de sesión obligatorio (contraseña por defecto 2026TyM*).
    """
    try:
        raw_body = json.loads(request.body) if request.body else {}
        body = validate_and_sanitize_payload(raw_body) if isinstance(raw_body, dict) else {}

        identity = str(body.get('identity') or request.session.get('active_user_email') or '').strip().lower()
        current_password = str(body.get('current_password') or '')
        new_password = str(body.get('new_password') or '')

        if not identity or not current_password or not new_password:
            return JsonResponse({'error': 'Todos los campos son obligatorios.'}, status=400)

        pwd_error = validate_strong_password(new_password)
        if pwd_error:
            return JsonResponse({'error': pwd_error}, status=400)

        if new_password == "2026TyM*":
            return JsonResponse({'error': 'La nueva contraseña no puede ser igual a la contraseña por defecto (2026TyM*).'}, status=400)

        if new_password == current_password:
            return JsonResponse({'error': 'La nueva contraseña debe ser diferente a la contraseña actual.'}, status=400)

        # Buscar usuario por email (id) o username
        target_record = AppUser.objects.only('id', 'data').filter(id__iexact=identity).first()
        if not target_record:
            for u in AppUser.objects.exclude(id='SYSTEM_METADATA').only('id', 'data'):
                if isinstance(u.data, dict):
                    if u.data.get('email', '').lower() == identity or u.data.get('username', '').lower() == identity:
                        target_record = u
                        break

        if not target_record or not isinstance(target_record.data, dict):
            return JsonResponse({'error': 'Usuario o correo electrónico no encontrado.'}, status=404)

        if target_record.data.get('password') != current_password:
            return JsonResponse({'error': 'La contraseña actual ingresada es incorrecta.'}, status=401)

        updated_data = dict(target_record.data)
        updated_data['password'] = new_password
        updated_data['mustChangePassword'] = False
        target_record.data = updated_data
        target_record.save()

        # Si el usuario tiene sesión activa, rotar su session_id y revocar sesiones antiguas
        active_email = (request.session.get('active_user_email') or '').lower()
        if active_email and active_email == target_record.id.lower():
            register_authenticated_session(request, target_record.id)
            revoke_user_sessions(target_record.id, exclude_session_key=request.session.session_key)
        else:
            revoke_user_sessions(target_record.id)

        return JsonResponse({'success': True, 'user': updated_data})
    except ValueError as ve:
        return JsonResponse({'error': str(ve)}, status=400)
    except Exception as e:
        return JsonResponse({'error': str(e)}, status=500)


@csrf_exempt
@require_http_methods(["POST"])
@require_auth
def revoke_sessions_view(request):
    """
    Permite revocar inmediatamente todas las sesiones activas de un usuario
    ante sospecha de compromiso de credenciales.
    - Un usuario estándar puede revocar todas sus propias sesiones.
    - Un Administrador puede revocar las sesiones de cualquier usuario indicando `email`.
    """
    try:
        body = json.loads(request.body) if request.body else {}
        body = validate_and_sanitize_payload(body) if isinstance(body, dict) else {}
        active_email = request.session.get('active_user_email')
        target_email = str(body.get('email') or active_email).strip().lower()
        include_current = bool(body.get('include_current', False))

        if target_email != active_email.lower():
            active_user = AppUser.objects.only('data').filter(id=active_email).first()
            if not active_user or not isinstance(active_user.data, dict) or active_user.data.get('role') != 'Administrador':
                return JsonResponse({'error': 'Solo un Administrador puede revocar sesiones de otros usuarios.'}, status=403)

        exclude_key = None if (include_current or target_email != active_email.lower()) else request.session.session_key
        revoked_count = revoke_user_sessions(target_email, exclude_session_key=exclude_key)

        if include_current and target_email == active_email.lower():
            invalidate_session(request)

        return JsonResponse({
            'success': True,
            'target_user': target_email,
            'revoked_sessions': revoked_count,
        })
    except ValueError as ve:
        return JsonResponse({'error': str(ve)}, status=400)
    except Exception as e:
        return JsonResponse({'error': str(e)}, status=500)


@require_http_methods(["GET"])
def me_view(request):
    email = request.session.get('active_user_email')
    if not email:
        return JsonResponse({'error': 'No session'}, status=401)
    user = AppUser.objects.only('id', 'data').filter(id=email).first()
    if user:
        return JsonResponse({'user': user.data})
    return JsonResponse({'error': 'User not found'}, status=404)


@require_http_methods(["GET"])
@never_cache
@require_auth
def init_state(request):
    try:
        state = {}
        for state_key, model_class in MODEL_MAPPING.items():
            if model_class == AppUser:
                records = list(
                    model_class.objects.exclude(id='SYSTEM_METADATA')
                    .only('data')
                    .values_list('data', flat=True)
                )
            elif state_key in ('salidas', 'reservas', 'garantias'):
                raw_records = model_class.objects.only('data').values_list('data', flat=True).iterator(chunk_size=500)
                records = []
                for r in raw_records:
                    if isinstance(r, dict):
                        r_copy = dict(r)
                        if state_key == 'salidas' and r_copy.get('carrierGuide') and len(str(r_copy['carrierGuide'])) > 200:
                            r_copy['carrierGuide'] = '__LAZY_IMAGE__'
                        elif state_key == 'reservas' and r_copy.get('receipt') and len(str(r_copy['receipt'])) > 200:
                            r_copy['receipt'] = '__LAZY_IMAGE__'
                        elif state_key == 'garantias' and isinstance(r_copy.get('evidence'), dict) and r_copy['evidence'].get('data'):
                            r_copy['evidence'] = {'name': r_copy['evidence'].get('name', 'evidencia'), 'data': '__LAZY_IMAGE__'}
                        records.append(r_copy)
                    else:
                        records.append(r)
            else:
                records = list(model_class.objects.only('data').values_list('data', flat=True))
            state[state_key] = records

        meta_record = AppUser.objects.only('data').filter(id='SYSTEM_METADATA').first()
        if meta_record and isinstance(meta_record.data, dict):
            for extra_key, extra_value in meta_record.data.items():
                if extra_key != 'activeUser':
                    state[extra_key] = extra_value
        else:
            state['backup'] = {"frequency": "Mensual", "time": "02:00", "emails": ""}
            state['backupsLog'] = []
            state['pedidosAccesorios'] = []
            state['rotulos'] = []
            state['simulations'] = []

        return JsonResponse(state)
    except Exception as e:
        return JsonResponse({'error': str(e)}, status=500)


@csrf_exempt
@require_http_methods(["GET", "POST", "PUT", "DELETE"])
@require_auth
def api_resource(request, resource_name, resource_id=None):
    if resource_name not in MODEL_MAPPING:
        return JsonResponse({'error': f'Unknown resource {resource_name}'}, status=404)

    model_class = MODEL_MAPPING[resource_name]
    id_field = ID_FIELDS[resource_name]

    if resource_id:
        resource_id = unquote(resource_id)

    if request.method == "GET":
        if resource_id:
            obj = model_class.objects.only('id', 'data').filter(id=resource_id).first()
            if not obj:
                return JsonResponse({'error': 'Not found'}, status=404)
            return JsonResponse(obj.data, safe=False)
        else:
            records = list(model_class.objects.only('data').values_list('data', flat=True))
            return JsonResponse(records, safe=False)

    elif request.method in ["POST", "PUT"]:
        try:
            raw_data = json.loads(request.body)
            data = validate_and_sanitize_payload(raw_data)

            if id_field is None:
                obj_id = str(data)
            else:
                if not isinstance(data, dict):
                    return JsonResponse({'error': 'Expected JSON object'}, status=400)
                obj_id = str(data.get(id_field, resource_id))

            if not obj_id or obj_id == 'None':
                return JsonResponse({'error': 'Missing ID'}, status=400)

            if resource_id and str(resource_id) != obj_id:
                model_class.objects.filter(id=resource_id).delete()
                resource_id = obj_id
            elif not resource_id:
                resource_id = obj_id

            existing_obj = model_class.objects.only('id', 'data').filter(id=resource_id).first()

            if isinstance(data, dict) and resource_name in ('salidas', 'reservas', 'garantias'):
                if existing_obj and isinstance(existing_obj.data, dict):
                    if resource_name == 'salidas' and data.get('carrierGuide') == '__LAZY_IMAGE__':
                        data['carrierGuide'] = existing_obj.data.get('carrierGuide', '')
                    elif resource_name == 'reservas' and data.get('receipt') == '__LAZY_IMAGE__':
                        data['receipt'] = existing_obj.data.get('receipt', '')
                    elif resource_name == 'garantias' and isinstance(data.get('evidence'), dict) and data['evidence'].get('data') == '__LAZY_IMAGE__':
                        data['evidence'] = existing_obj.data.get('evidence')

            if resource_name == 'facturacion' and existing_obj is not None:
                active_email = request.session.get('active_user_email')
                active_user = AppUser.objects.only('data').filter(id=active_email).first()
                if not active_user or not isinstance(active_user.data, dict) or active_user.data.get('role') != 'Administrador':
                    return JsonResponse({'error': 'Solo un Administrador puede modificar este documento'}, status=403)

            # Detectar cambio de privilegios o contraseña en usuarios para rotar/revocar sesiones (Anti-Fixation)
            privilege_changed = False
            if resource_name == 'users' and existing_obj and isinstance(existing_obj.data, dict) and isinstance(data, dict):
                old_role = existing_obj.data.get('role')
                old_perms = existing_obj.data.get('perms')
                old_pwd = existing_obj.data.get('password')
                if (data.get('role') != old_role) or (data.get('perms') != old_perms) or (data.get('password') != old_pwd):
                    privilege_changed = True

            model_class.objects.update_or_create(
                id=resource_id,
                defaults={'data': data}
            )

            if privilege_changed:
                active_email = (request.session.get('active_user_email') or '').lower()
                if resource_id.lower() == active_email:
                    register_authenticated_session(request, resource_id)
                    revoke_user_sessions(resource_id, exclude_session_key=request.session.session_key)
                else:
                    revoke_user_sessions(resource_id)

            return JsonResponse({'success': True, 'id': resource_id})
        except ValueError as ve:
            return JsonResponse({'error': str(ve)}, status=400)
        except Exception as e:
            return JsonResponse({'error': str(e)}, status=500)

    elif request.method == "DELETE":
        if not resource_id:
            return JsonResponse({'error': 'Missing ID for deletion'}, status=400)
        if resource_name == 'facturacion':
            active_email = request.session.get('active_user_email')
            active_user = AppUser.objects.only('data').filter(id=active_email).first()
            if not active_user or not isinstance(active_user.data, dict) or active_user.data.get('role') != 'Administrador':
                return JsonResponse({'error': 'Solo un Administrador puede eliminar este documento'}, status=403)
        if resource_name == 'users':
            revoke_user_sessions(resource_id)
        model_class.objects.filter(id=resource_id).delete()
        return JsonResponse({'success': True})


@csrf_exempt
@require_http_methods(["POST"])
@require_auth
def sync_metadata(request):
    try:
        raw_state = json.loads(request.body)
        new_state = validate_and_sanitize_payload(raw_state)
        extra_keys = ['backup', 'backupsLog', 'pedidosAccesorios', 'rotulos', 'simulations']
        meta_data = {}
        for key in extra_keys:
            if key in new_state:
                meta_data[key] = new_state[key]

        existing_meta = AppUser.objects.only('data').filter(id='SYSTEM_METADATA').first()
        if existing_meta and isinstance(existing_meta.data, dict):
            for key in extra_keys:
                if key in existing_meta.data and (key not in meta_data or meta_data[key] is None or meta_data[key] == []):
                    meta_data[key] = existing_meta.data[key]

        AppUser.objects.update_or_create(
            id='SYSTEM_METADATA',
            defaults={'data': meta_data}
        )
        return JsonResponse({'success': True})
    except ValueError as ve:
        return JsonResponse({'error': str(ve)}, status=400)
    except Exception as e:
        return JsonResponse({'error': str(e)}, status=500)


@csrf_exempt
@require_http_methods(["POST"])
@require_auth
def sync_state(request):
    return JsonResponse({'success': True, 'message': 'Endpoint deprecado. Use APIs granulares.'})


class ProductListCreateView(generics.ListCreateAPIView):
    queryset = Product.objects.only('id', 'data', 'sucursal_id', 'sku', 'created_at').all()
    serializer_class = ProductSerializer