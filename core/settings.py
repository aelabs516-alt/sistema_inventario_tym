"""
Django settings for core project - Optimizado para VPS (6 vCPUs / 12 GB RAM) y Hardening de Seguridad.
"""

import os
import environ
from pathlib import Path
import django.utils.cache
from django.utils.regex_helper import _lazy_re_compile
from core.db_pool import configure_django_database_pool

# Compatibilidad de djangorestframework con Django 6.0+
if not hasattr(django.utils.cache, 'cc_delim_re'):
    django.utils.cache.cc_delim_re = _lazy_re_compile(r"\s*,\s*")

# Build paths inside the project like this: BASE_DIR / 'subdir'.
BASE_DIR = Path(__file__).resolve().parent.parent

# Inicializar django-environ
env = environ.Env(
    DEBUG=(bool, False)
)
# Leer .env file si existe
environ.Env.read_env(os.path.join(BASE_DIR, '.env'))

SECRET_KEY = env('SECRET_KEY', default='unsafe-secret-key-for-build-only')
DEBUG = env('DEBUG', default=False)

ALLOWED_HOSTS = env.list('ALLOWED_HOSTS', default=['*'])

# --- CONFIGURACIÓN DE SEGURIDAD PARA PROXY Y CORS ESTRICTO ---
DEFAULT_AUTHORIZED_ORIGINS = [
    'https://sistema-inventario-360-sistema-inventario-360.qvzazj.easypanel.host',
    'http://localhost:8000',
    'http://127.0.0.1:8000',
]
CSRF_TRUSTED_ORIGINS = env.list('CSRF_TRUSTED_ORIGINS', default=DEFAULT_AUTHORIZED_ORIGINS)
CORS_ALLOWED_ORIGINS = env.list('CORS_ALLOWED_ORIGINS', default=DEFAULT_AUTHORIZED_ORIGINS)

SECURE_PROXY_SSL_HEADER = ('HTTP_X_FORWARDED_PROTO', 'https')
USE_X_FORWARDED_HOST = True
# -------------------------------------------------------------

INSTALLED_APPS = [
    'django.contrib.admin',
    'django.contrib.auth',
    'django.contrib.contenttypes',
    'django.contrib.sessions',
    'django.contrib.messages',
    'django.contrib.staticfiles',
    'rest_framework',
    'inventario',
]

MIDDLEWARE = [
    'django.middleware.security.SecurityMiddleware',
    'core.security.StrictCORSMiddleware',
    'core.security.SecurityHeadersMiddleware',
    'django.middleware.gzip.GZipMiddleware',
    'whitenoise.middleware.WhiteNoiseMiddleware',
    'django.contrib.sessions.middleware.SessionMiddleware',
    'core.security.RateLimitMiddleware',
    'core.security.SessionSecurityMiddleware',
    'django.middleware.common.CommonMiddleware',
    'django.middleware.csrf.CsrfViewMiddleware',
    'django.contrib.auth.middleware.AuthenticationMiddleware',
    'django.contrib.messages.middleware.MessageMiddleware',
    'django.middleware.clickjacking.XFrameOptionsMiddleware',
]

ROOT_URLCONF = 'core.urls'

TEMPLATES = [
    {
        'BACKEND': 'django.template.backends.django.DjangoTemplates',
        'DIRS': [],
        'APP_DIRS': True,
        'OPTIONS': {
            'context_processors': [
                'django.template.context_processors.request',
                'django.contrib.auth.context_processors.auth',
                'django.contrib.messages.context_processors.messages',
            ],
        },
    },
]

WSGI_APPLICATION = 'core.wsgi.application'

# --- 1. OPTIMIZACIÓN DE BASE DE DATOS Y CONNECTION POOLING ---
DATABASES = {
    'default': configure_django_database_pool(
        env.db('DATABASE_URL', default='sqlite:///' + str(BASE_DIR / 'db.sqlite3'))
    )
}

# --- 2. CACHÉ Y ALMACENAMIENTO CENTRALIZADO DE SESIONES (REDIS / POSTGRESQL) ---
REDIS_URL = env('REDIS_URL', default='')
if REDIS_URL:
    CACHES = {
        'default': {
            'BACKEND': 'django.core.cache.backends.redis.DjangoCache',
            'LOCATION': REDIS_URL,
        }
    }
    SESSION_ENGINE = 'django.contrib.sessions.backends.cached_db'
else:
    CACHES = {
        'default': {
            'BACKEND': 'django.core.cache.backends.locmem.LocMemCache',
            'LOCATION': 'inv360-security-cache',
        }
    }
    SESSION_ENGINE = 'django.contrib.sessions.backends.db'

# --- 3. GESTIÓN ROBUSTA DE SESIONES Y COOKIE __Host-session_id ---
SESSION_COOKIE_HTTPONLY = True
SESSION_COOKIE_SECURE = env.bool('SESSION_COOKIE_SECURE', default=not DEBUG)
SESSION_COOKIE_SAMESITE = env('SESSION_COOKIE_SAMESITE', default='Lax')
# __Host- exige Secure=True, Path='/' y sin atributo Domain (RFC 6265bis)
SESSION_COOKIE_NAME = env(
    'SESSION_COOKIE_NAME',
    default='__Host-session_id' if SESSION_COOKIE_SECURE else 'session_id'
)
SESSION_COOKIE_PATH = '/'
SESSION_COOKIE_DOMAIN = None

# Doble expiración: Idle Timeout (45 min = 2700s) y Absolute Timeout (12h = 43200s)
SESSION_IDLE_TIMEOUT = env.int('SESSION_IDLE_TIMEOUT', default=2700)
SESSION_ABSOLUTE_TIMEOUT = env.int('SESSION_ABSOLUTE_TIMEOUT', default=43200)
SESSION_COOKIE_AGE = SESSION_ABSOLUTE_TIMEOUT
SESSION_SAVE_EVERY_REQUEST = False

# --- 4. HARDENING: RATE LIMITING Y CABECERAS HTTP ---
RATE_LIMIT_LOGIN_PER_MIN = env.int('RATE_LIMIT_LOGIN_PER_MIN', default=5)
RATE_LIMIT_GENERAL_PER_MIN = env.int('RATE_LIMIT_GENERAL_PER_MIN', default=120)
X_FRAME_OPTIONS = env('X_FRAME_OPTIONS', default='DENY')
CONTENT_SECURITY_POLICY = env(
    'CONTENT_SECURITY_POLICY',
    default=(
        "default-src 'self'; "
        "script-src 'self' 'unsafe-inline' 'unsafe-eval' https://unpkg.com https://cdn.jsdelivr.net https://cdnjs.cloudflare.com; "
        "worker-src 'self' blob: https://cdnjs.cloudflare.com; "
        "style-src 'self' 'unsafe-inline' https://fonts.googleapis.com; "
        "font-src 'self' https://fonts.gstatic.com data:; "
        "img-src 'self' data: blob: https://images.unsplash.com https:; "
        "connect-src 'self';"
    ),
)

AUTH_PASSWORD_VALIDATORS = [
    {'NAME': 'django.contrib.auth.password_validation.UserAttributeSimilarityValidator'},
    {'NAME': 'django.contrib.auth.password_validation.MinimumLengthValidator'},
    {'NAME': 'django.contrib.auth.password_validation.CommonPasswordValidator'},
    {'NAME': 'django.contrib.auth.password_validation.NumericPasswordValidator'},
]

LANGUAGE_CODE = 'en-us'
TIME_ZONE = 'UTC'
USE_I18N = True
USE_TZ = True

STATIC_URL = 'static/'
STATIC_ROOT = BASE_DIR / 'staticfiles'
STATICFILES_DIRS = [BASE_DIR / 'public']
WHITENOISE_ROOT = BASE_DIR / 'public'
WHITENOISE_INDEX_FILE = True