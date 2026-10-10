"""Django settings for photo_transfer project."""
import os
from pathlib import Path

BASE_DIR = Path(__file__).resolve().parent.parent

# ===== 安全配置 =====
SECRET_KEY = os.environ.get('DJANGO_SECRET_KEY', 'photo-transfer-django-dev-secret-change-me')
DEBUG = os.environ.get('DJANGO_DEBUG', 'True').lower() in ('true', '1', 'yes')
ALLOWED_HOSTS = ['*']

# ===== 应用 =====
INSTALLED_APPS = [
    'django.contrib.contenttypes',
    'django.contrib.auth',
    'api',  # 我们的 app
]

MIDDLEWARE = [
    'django.middleware.security.SecurityMiddleware',
    'django.middleware.common.CommonMiddleware',
    'django.middleware.csrf.CsrfViewMiddleware',
]

ROOT_URLCONF = 'photo_transfer.urls'

TEMPLATES = []  # 不需要 Django 模板，前端是 SPA

WSGI_APPLICATION = 'photo_transfer.wsgi.application'

# ===== SQLite 数据库 =====
DATABASES = {
    'default': {
        'ENGINE': 'django.db.backends.sqlite3',
        'NAME': os.environ.get('SQLITE_DB_PATH', BASE_DIR / '..' / 'data' / 'app.db'),
    }
}

DEFAULT_AUTO_FIELD = 'django.db.models.BigAutoField'

# ===== 静态文件（前端 SPA）=====
STATIC_URL = '/static/'
CLIENT_DIST = BASE_DIR / '..' / 'dist' / 'client'  # 前端构建产物

# ===== 上传文件目录 =====
UPLOAD_DIR = BASE_DIR / '..' / 'data' / 'uploads'
UPLOAD_DIR.mkdir(parents=True, exist_ok=True)

# ===== JWT 配置（与 NestJS 保持一致）=====
JWT_SECRET = os.environ.get('JWT_SECRET', 'photo-transfer-dev-secret-change-me')
JWT_EXPIRE_SECONDS = 7 * 24 * 3600  # 7 天

# ===== 日志 =====
LOGGING = {
    'version': 1,
    'disable_existing_loggers': False,
    'handlers': {
        'console': { 'class': 'logging.StreamHandler' },
    },
    'root': { 'handlers': ['console'], 'level': 'INFO' },
}
