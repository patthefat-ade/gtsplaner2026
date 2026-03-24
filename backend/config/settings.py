"""
Django settings for Kassenbuch App v2.

Kassenbuch für Freizeitpädagoginnen – Django + Next.js Headless Architecture.
"""

import os
from datetime import timedelta
from pathlib import Path

import dj_database_url
from decouple import Csv, config

# Build paths inside the project like this: BASE_DIR / 'subdir'.
BASE_DIR = Path(__file__).resolve().parent.parent

# SECURITY WARNING: keep the secret key used in production secret!
SECRET_KEY = config("SECRET_KEY", default="django-insecure-dev-key")

# SECURITY WARNING: don't run with debug turned on in production!
DEBUG = config("DEBUG", default=False, cast=bool)

ALLOWED_HOSTS = config("ALLOWED_HOSTS", default="*", cast=Csv())

# ---------------------------------------------------------------------------
# Application definition
# ---------------------------------------------------------------------------

INSTALLED_APPS = [
    # Django Unfold Admin (muss vor django.contrib.admin stehen)
    "unfold",
    "unfold.contrib.filters",
    "unfold.contrib.forms",
    # Django Core
    "django.contrib.admin",
    "django.contrib.auth",
    "django.contrib.contenttypes",
    "django.contrib.sessions",
    "django.contrib.messages",
    "django.contrib.staticfiles",
    # Third Party
    "rest_framework",
    "rest_framework_simplejwt",
    "rest_framework_simplejwt.token_blacklist",
    "drf_spectacular",
    "corsheaders",
    "django_filters",
    # Project Apps
    "core.apps.CoreConfig",
    "finance.apps.FinanceConfig",
    "timetracking.apps.TimetrackingConfig",
    "groups.apps.GroupsConfig",
    "admin_panel.apps.AdminPanelConfig",
    "system.apps.SystemConfig",
]

MIDDLEWARE = [
    "django.middleware.security.SecurityMiddleware",
    "whitenoise.middleware.WhiteNoiseMiddleware",
    "django.contrib.sessions.middleware.SessionMiddleware",
    "corsheaders.middleware.CorsMiddleware",
    "django.middleware.common.CommonMiddleware",
    "django.middleware.csrf.CsrfViewMiddleware",
    "django.contrib.auth.middleware.AuthenticationMiddleware",
    "django.contrib.messages.middleware.MessageMiddleware",
    "django.middleware.clickjacking.XFrameOptionsMiddleware",
    "system.middleware.AuditLoggingMiddleware",
]

ROOT_URLCONF = "config.urls"

TEMPLATES = [
    {
        "BACKEND": "django.template.backends.django.DjangoTemplates",
        "DIRS": [BASE_DIR / "templates"],
        "APP_DIRS": True,
        "OPTIONS": {
            "context_processors": [
                "django.template.context_processors.debug",
                "django.template.context_processors.request",
                "django.contrib.auth.context_processors.auth",
                "django.contrib.messages.context_processors.messages",
            ],
        },
    },
]

WSGI_APPLICATION = "config.wsgi.application"

# ---------------------------------------------------------------------------
# Database
# ---------------------------------------------------------------------------

# DATABASE_URL wird von DigitalOcean Managed Database automatisch injiziert.
# Fallback auf einzelne DB_* Variablen oder SQLite für lokale Entwicklung.
DATABASE_URL = os.environ.get("DATABASE_URL", "")

# DigitalOcean Dev Databases können eine leere oder ungültige URL injizieren.
# Nur parsen wenn die URL ein gültiges Schema enthält (z.B. postgresql://).
if DATABASE_URL and "://" in DATABASE_URL and not DATABASE_URL.startswith("://"):
    DATABASES = {
        "default": dj_database_url.parse(
            DATABASE_URL,
            conn_max_age=600,
            conn_health_checks=True,
        )
    }
else:
    DATABASES = {
        "default": {
            "ENGINE": config("DB_ENGINE", default="django.db.backends.sqlite3"),
            "NAME": config("DB_NAME", default=str(BASE_DIR / "db.sqlite3")),
            "USER": config("DB_USER", default=""),
            "PASSWORD": config("DB_PASSWORD", default=""),
            "HOST": config("DB_HOST", default=""),
            "PORT": config("DB_PORT", default=""),
        }
    }

# ---------------------------------------------------------------------------
# Password validation
# ---------------------------------------------------------------------------

AUTH_PASSWORD_VALIDATORS = [
    {"NAME": "django.contrib.auth.password_validation.UserAttributeSimilarityValidator"},
    {"NAME": "django.contrib.auth.password_validation.MinimumLengthValidator"},
    {"NAME": "django.contrib.auth.password_validation.CommonPasswordValidator"},
    {"NAME": "django.contrib.auth.password_validation.NumericPasswordValidator"},
]

# ---------------------------------------------------------------------------
# Internationalization
# ---------------------------------------------------------------------------

LANGUAGE_CODE = "de"
TIME_ZONE = "Europe/Vienna"
USE_I18N = True
USE_TZ = True

# ---------------------------------------------------------------------------
# Static files (CSS, JavaScript, Images)
# ---------------------------------------------------------------------------

STATIC_URL = "static/"
STATIC_ROOT = BASE_DIR / "staticfiles"
STATICFILES_STORAGE = "whitenoise.storage.CompressedStaticFilesStorage"

MEDIA_URL = "media/"
MEDIA_ROOT = BASE_DIR / "media"

# ---------------------------------------------------------------------------
# Default primary key field type
# ---------------------------------------------------------------------------

DEFAULT_AUTO_FIELD = "django.db.models.BigAutoField"

# ---------------------------------------------------------------------------
# Custom User Model
# ---------------------------------------------------------------------------

AUTH_USER_MODEL = "core.User"

# ---------------------------------------------------------------------------
# Django REST Framework
# ---------------------------------------------------------------------------

REST_FRAMEWORK = {
    "DEFAULT_AUTHENTICATION_CLASSES": (
        "rest_framework_simplejwt.authentication.JWTAuthentication",
        "rest_framework.authentication.SessionAuthentication",
    ),
    "DEFAULT_PERMISSION_CLASSES": (
        "rest_framework.permissions.IsAuthenticated",
    ),
    "DEFAULT_FILTER_BACKENDS": (
        "django_filters.rest_framework.DjangoFilterBackend",
        "rest_framework.filters.SearchFilter",
        "rest_framework.filters.OrderingFilter",
    ),
    "DEFAULT_PAGINATION_CLASS": "rest_framework.pagination.PageNumberPagination",
    "PAGE_SIZE": 25,
    "DEFAULT_SCHEMA_CLASS": "drf_spectacular.openapi.AutoSchema",
    "DEFAULT_RENDERER_CLASSES": (
        "rest_framework.renderers.JSONRenderer",
    ),
    "DEFAULT_THROTTLE_CLASSES": [
        "rest_framework.throttling.AnonRateThrottle",
        "rest_framework.throttling.UserRateThrottle",
    ],
    "DEFAULT_THROTTLE_RATES": {
        "anon": "100/hour",
        "user": "1000/hour",
    },
    "DATETIME_FORMAT": "%Y-%m-%dT%H:%M:%S%z",
    "DATE_FORMAT": "%Y-%m-%d",
    "TIME_FORMAT": "%H:%M:%S",
}

# ---------------------------------------------------------------------------
# SimpleJWT Configuration
# ---------------------------------------------------------------------------

SIMPLE_JWT = {
    "ACCESS_TOKEN_LIFETIME": timedelta(
        minutes=config("JWT_ACCESS_TOKEN_LIFETIME_MINUTES", default=60, cast=int)
    ),
    "REFRESH_TOKEN_LIFETIME": timedelta(
        days=config("JWT_REFRESH_TOKEN_LIFETIME_DAYS", default=7, cast=int)
    ),
    "ROTATE_REFRESH_TOKENS": True,
    "BLACKLIST_AFTER_ROTATION": True,
    "UPDATE_LAST_LOGIN": True,
    "AUTH_HEADER_TYPES": ("Bearer",),
    "AUTH_TOKEN_CLASSES": ("rest_framework_simplejwt.tokens.AccessToken",),
}

# ---------------------------------------------------------------------------
# drf-spectacular (OpenAPI 3.0)
# ---------------------------------------------------------------------------

SPECTACULAR_SETTINGS = {
    "TITLE": "Kassenbuch App v2 API",
    "DESCRIPTION": (
        "REST API für die Kassenbuch App v2 – "
        "Verwaltung von Klassenkassen für Freizeitpädagoginnen. "
        "Django + Next.js Headless Architecture."
    ),
    "VERSION": "2.0.0",
    "SERVE_INCLUDE_SCHEMA": False,
    "COMPONENT_SPLIT_REQUEST": True,
    "SCHEMA_PATH_PREFIX": r"/api/v1",
    "TAGS": [
        {"name": "Auth", "description": "Authentifizierung & Token-Management"},
        {"name": "Users", "description": "Benutzerverwaltung"},
        {"name": "Finance", "description": "Kassenbuch & Transaktionen"},
        {"name": "TimeTracking", "description": "Zeiterfassung & Arbeitszeiten"},
        {"name": "Groups", "description": "Gruppen- & Schülerverwaltung"},
        {"name": "Admin", "description": "Admin-Funktionen & Systemverwaltung"},
        {"name": "System", "description": "Systemeinstellungen & Audit-Log"},
    ],
}

# ---------------------------------------------------------------------------
# CORS Configuration
# ---------------------------------------------------------------------------

CORS_ALLOWED_ORIGINS = config(
    "CORS_ALLOWED_ORIGINS",
    default="http://localhost:3000,http://127.0.0.1:3000,https://gtsplaner-58p4a.ondigitalocean.app,https://gtsplaner.app",
    cast=Csv(),
)
CORS_ALLOW_CREDENTIALS = True
CSRF_TRUSTED_ORIGINS = config(
    "CSRF_TRUSTED_ORIGINS",
    default="http://localhost:3000,https://gtsplaner-58p4a.ondigitalocean.app,https://gtsplaner.app",
    cast=Csv(),
)

# ---------------------------------------------------------------------------
# Celery Configuration
# ---------------------------------------------------------------------------

CELERY_BROKER_URL = config("CELERY_BROKER_URL", default="redis://localhost:6379/0")
CELERY_RESULT_BACKEND = config("CELERY_RESULT_BACKEND", default="redis://localhost:6379/1")
CELERY_ACCEPT_CONTENT = ["json"]
CELERY_TASK_SERIALIZER = "json"
CELERY_RESULT_SERIALIZER = "json"
CELERY_TIMEZONE = TIME_ZONE

# ---------------------------------------------------------------------------
# Email Configuration
# ---------------------------------------------------------------------------

EMAIL_BACKEND = config("EMAIL_BACKEND", default="django.core.mail.backends.console.EmailBackend")
EMAIL_HOST = config("EMAIL_HOST", default="smtp.example.com")
EMAIL_PORT = config("EMAIL_PORT", default=587, cast=int)
EMAIL_USE_TLS = config("EMAIL_USE_TLS", default=True, cast=bool)
EMAIL_HOST_USER = config("EMAIL_HOST_USER", default="")
EMAIL_HOST_PASSWORD = config("EMAIL_HOST_PASSWORD", default="")
DEFAULT_FROM_EMAIL = config("DEFAULT_FROM_EMAIL", default="noreply@kassenbuch.local")

# ---------------------------------------------------------------------------
# Django Unfold Admin Configuration
# ---------------------------------------------------------------------------

UNFOLD = {
    "SITE_TITLE": "GTS Planner Admin",
    "SITE_HEADER": "GTS Planner",
    "SITE_SYMBOL": "school",
    "SHOW_HISTORY": True,
    "SHOW_VIEW_ON_SITE": True,
    "COLORS": {
        "primary": {
            "50": "255 249 196",
            "100": "255 243 140",
            "200": "255 238 88",
            "300": "255 235 59",
            "400": "255 224 0",
            "500": "255 204 0",
            "600": "253 184 0",
            "700": "251 164 0",
            "800": "249 144 0",
            "900": "245 124 0",
            "950": "230 100 0",
        },
    },
    "SIDEBAR": {
        "show_search": True,
        "show_all_applications": True,
        "navigation": [
            {
                "title": "Benutzerverwaltung",
                "separator": True,
                "items": [
                    {
                        "title": "Benutzer",
                        "icon": "people",
                        "link": "/admin/core/user/",
                    },
                ],
            },
            {
                "title": "Standorte & Organisation",
                "separator": True,
                "items": [
                    {
                        "title": "Organisationen",
                        "icon": "corporate_fare",
                        "link": "/admin/core/organization/",
                    },
                    {
                        "title": "Standorte",
                        "icon": "location_on",
                        "link": "/admin/core/location/",
                    },
                ],
            },
            {
                "title": "Kassenbuch",
                "separator": True,
                "items": [
                    {
                        "title": "Transaktionen",
                        "icon": "payments",
                        "link": "/admin/finance/transaction/",
                    },
                    {
                        "title": "Kategorien",
                        "icon": "category",
                        "link": "/admin/finance/transactioncategory/",
                    },
                ],
            },
            {
                "title": "Zeiterfassung",
                "separator": True,
                "items": [
                    {
                        "title": "Zeiteinträge",
                        "icon": "schedule",
                        "link": "/admin/timetracking/timeentry/",
                    },
                    {
                        "title": "Urlaubsanträge",
                        "icon": "beach_access",
                        "link": "/admin/timetracking/leaverequest/",
                    },
                ],
            },
            {
                "title": "Gruppen",
                "separator": True,
                "items": [
                    {
                        "title": "Gruppen",
                        "icon": "groups",
                        "link": "/admin/groups/group/",
                    },
                    {
                        "title": "Schüler",
                        "icon": "school",
                        "link": "/admin/groups/student/",
                    },
                ],
            },
            {
                "title": "System",
                "separator": True,
                "items": [
                    {
                        "title": "Audit-Log",
                        "icon": "history",
                        "link": "/admin/system/auditlog/",
                    },
                    {
                        "title": "Einstellungen",
                        "icon": "settings",
                        "link": "/admin/system/systemsetting/",
                    },
                ],
            },
        ],
    },
}

# ---------------------------------------------------------------------------
# Logging Configuration
# ---------------------------------------------------------------------------

LOGGING = {
    "version": 1,
    "disable_existing_loggers": False,
    "formatters": {
        "verbose": {
            "format": "{levelname} {asctime} {module} {process:d} {thread:d} {message}",
            "style": "{",
        },
        "simple": {
            "format": "{levelname} {message}",
            "style": "{",
        },
    },
    "handlers": {
        "console": {
            "class": "logging.StreamHandler",
            "formatter": "verbose",
        },
    },
    "root": {
        "handlers": ["console"],
        "level": "INFO",
    },
    "loggers": {
        "django": {
            "handlers": ["console"],
            "level": config("DJANGO_LOG_LEVEL", default="INFO"),
            "propagate": False,
        },
        "kassenbuch": {
            "handlers": ["console"],
            "level": "DEBUG" if DEBUG else "INFO",
            "propagate": False,
        },
    },
}
