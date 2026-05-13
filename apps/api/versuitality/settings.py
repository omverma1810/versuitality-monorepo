"""Django settings for the Versuitality API."""
from __future__ import annotations

import os
from datetime import timedelta
from pathlib import Path

import environ

BASE_DIR = Path(__file__).resolve().parent.parent

env = environ.Env(
    DJANGO_DEBUG=(bool, False),
)

SECRET_KEY = os.environ.get(
    'DJANGO_SECRET_KEY', 'dev-only-not-for-production-change-me'
)
DEBUG = env.bool('DJANGO_DEBUG', default=True)


def _csv_env(name: str, default: str = '') -> list[str]:
    return [v.strip() for v in os.environ.get(name, default).split(',') if v.strip()]


ALLOWED_HOSTS = _csv_env('DJANGO_ALLOWED_HOSTS', 'localhost,127.0.0.1,api')

# Cloud Run injects requests via a randomised *.run.app hostname plus your
# custom domain. Setting this env var to "1" tells Django to accept any host
# (safe behind Cloud Run's frontend; do NOT enable on an open VM).
if os.environ.get('DJANGO_TRUST_ALL_HOSTS') == '1':
    ALLOWED_HOSTS = ['*']

# When sitting behind a reverse proxy that terminates TLS (Cloud Run, Caddy,
# Nginx), trust the X-Forwarded-Proto header so request.is_secure() works.
SECURE_PROXY_SSL_HEADER = ('HTTP_X_FORWARDED_PROTO', 'https')
USE_X_FORWARDED_HOST = True

CSRF_TRUSTED_ORIGINS = _csv_env(
    'DJANGO_CSRF_TRUSTED_ORIGINS',
    'http://localhost:3000,http://localhost:8000',
)

INSTALLED_APPS = [
    # 'daphne' must be first so runserver delegates to the ASGI server.
    'daphne',
    'django.contrib.admin',
    'django.contrib.auth',
    'django.contrib.contenttypes',
    'django.contrib.sessions',
    'django.contrib.messages',
    'django.contrib.staticfiles',
    # Third-party
    'rest_framework',
    'rest_framework_simplejwt',
    'rest_framework_simplejwt.token_blacklist',
    'corsheaders',
    'channels',
    # Local
    'apps.core',
    'apps.accounts',
    'apps.crm',
    'apps.measurements',
    'apps.orders',
    'apps.realtime',
    'apps.qa',
    'apps.notifications',
    'apps.inventory',
    'apps.appointments',
    'apps.analytics',
]

MIDDLEWARE = [
    'corsheaders.middleware.CorsMiddleware',
    'django.middleware.security.SecurityMiddleware',
    'django.contrib.sessions.middleware.SessionMiddleware',
    'django.middleware.common.CommonMiddleware',
    'django.middleware.csrf.CsrfViewMiddleware',
    'django.contrib.auth.middleware.AuthenticationMiddleware',
    'django.contrib.messages.middleware.MessageMiddleware',
    'django.middleware.clickjacking.XFrameOptionsMiddleware',
]

ROOT_URLCONF = 'versuitality.urls'

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

WSGI_APPLICATION = 'versuitality.wsgi.application'
ASGI_APPLICATION = 'versuitality.asgi.application'

DATABASES = {
    'default': {
        'ENGINE': 'django.db.backends.postgresql',
        'NAME': os.environ.get('POSTGRES_DB', 'versuitality'),
        'USER': os.environ.get('POSTGRES_USER', 'versuitality'),
        'PASSWORD': os.environ.get('POSTGRES_PASSWORD', 'versuitality_dev'),
        'HOST': os.environ.get('POSTGRES_HOST', 'localhost'),
        'PORT': os.environ.get('POSTGRES_PORT', '5432'),
    }
}

AUTH_USER_MODEL = 'accounts.User'

AUTHENTICATION_BACKENDS = [
    'django.contrib.auth.backends.ModelBackend',
]

AUTH_PASSWORD_VALIDATORS = [
    {'NAME': 'django.contrib.auth.password_validation.UserAttributeSimilarityValidator'},
    {'NAME': 'django.contrib.auth.password_validation.MinimumLengthValidator',
     'OPTIONS': {'min_length': 8}},
    {'NAME': 'django.contrib.auth.password_validation.CommonPasswordValidator'},
    {'NAME': 'django.contrib.auth.password_validation.NumericPasswordValidator'},
]

LANGUAGE_CODE = 'en-us'
TIME_ZONE = 'UTC'
USE_I18N = True
USE_TZ = True

STATIC_URL = 'static/'
STATIC_ROOT = BASE_DIR / 'staticfiles'
MEDIA_URL = 'media/'
MEDIA_ROOT = BASE_DIR / 'media'

DEFAULT_AUTO_FIELD = 'django.db.models.BigAutoField'

# --- DRF -------------------------------------------------------------------
REST_FRAMEWORK = {
    'DEFAULT_AUTHENTICATION_CLASSES': (
        'rest_framework_simplejwt.authentication.JWTAuthentication',
        'rest_framework.authentication.SessionAuthentication',
    ),
    'DEFAULT_PERMISSION_CLASSES': (
        'rest_framework.permissions.IsAuthenticated',
    ),
    'DEFAULT_RENDERER_CLASSES': (
        'rest_framework.renderers.JSONRenderer',
    ),
    'DEFAULT_PAGINATION_CLASS': 'rest_framework.pagination.LimitOffsetPagination',
    'PAGE_SIZE': 25,
}

# --- SimpleJWT -------------------------------------------------------------
SIMPLE_JWT = {
    'ACCESS_TOKEN_LIFETIME': timedelta(minutes=30),
    'REFRESH_TOKEN_LIFETIME': timedelta(days=7),
    'ROTATE_REFRESH_TOKENS': True,
    'BLACKLIST_AFTER_ROTATION': True,
    'AUTH_HEADER_TYPES': ('Bearer',),
    'USER_ID_FIELD': 'id',
    'USER_ID_CLAIM': 'user_id',
    'TOKEN_TYPE_CLAIM': 'token_type',
    'AUTH_TOKEN_CLASSES': ('rest_framework_simplejwt.tokens.AccessToken',),
}

# --- CORS ------------------------------------------------------------------
CORS_ALLOWED_ORIGINS = [
    o.strip()
    for o in os.environ.get(
        'DJANGO_CORS_ORIGINS', 'http://localhost:3000'
    ).split(',')
    if o.strip()
]
CORS_ALLOW_CREDENTIALS = True

# --- Channels (Phase 4 — real-time order board) ---------------------------
REDIS_HOST = os.environ.get('REDIS_HOST', 'localhost')
REDIS_PORT = int(os.environ.get('REDIS_PORT', '6379'))

CHANNEL_LAYERS = {
    'default': {
        'BACKEND': 'channels_redis.core.RedisChannelLayer',
        'CONFIG': {
            'hosts': [(REDIS_HOST, REDIS_PORT)],
        },
    },
}

# --- Notifications (Phase 6) ----------------------------------------------
# When these credentials are blank, providers fall back to the console
# logger so the rest of the pipeline (Notification rows, admin log, UI
# panel) is exercised in dev. Drop real values into .env to flip to live
# delivery without any code changes.
SENDGRID_API_KEY = os.environ.get('SENDGRID_API_KEY', '')
NOTIFICATION_EMAIL_FROM = os.environ.get('NOTIFICATION_EMAIL_FROM', 'orders@versuitality.com')
NOTIFICATION_EMAIL_FROM_NAME = os.environ.get('NOTIFICATION_EMAIL_FROM_NAME', 'Versuitality')

TWILIO_ACCOUNT_SID = os.environ.get('TWILIO_ACCOUNT_SID', '')
TWILIO_AUTH_TOKEN = os.environ.get('TWILIO_AUTH_TOKEN', '')
TWILIO_WHATSAPP_FROM = os.environ.get('TWILIO_WHATSAPP_FROM', '')

# --- Versuitality config ---------------------------------------------------
VERSUITALITY = {
    'BRAND_NAME': 'Versuitality',
    'ORDER_ID_PREFIX': 'VS',
    'WEB_BASE_URL': os.environ.get('WEB_BASE_URL', 'http://localhost:3000'),
}
