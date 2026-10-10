from django.contrib import admin  # noqa (no admin needed)
from django.urls import path, re_path, include
from django.http import FileResponse, Http404
from django.shortcuts import render  # noqa

from api import views as api_views
from django.conf import settings
import os


def serve_index(request):
    """SPA fallback: 所有页面路由返回 index.html"""
    index_path = settings.CLIENT_DIST / 'index.html'
    if not index_path.exists():
        return Http404('index.html not found')
    return FileResponse(open(index_path, 'rb'), content_type='text/html')


def serve_static(request, path):
    """前端静态资源（JS/CSS/image）"""
    file_path = settings.CLIENT_DIST / path
    if file_path.exists() and file_path.is_file():
        return FileResponse(open(file_path, 'rb'))
    raise Http404()


urlpatterns = [
    # ===== API =====
    path('api/auth/register', api_views.auth_register),
    path('api/auth/login', api_views.auth_login),
    path('api/auth/me', api_views.auth_me),

    path('api/qr/sessions', api_views.create_session),
    path('api/qr/sessions/from-permanent/<str:permanent_code>', api_views.create_from_permanent),
    path('api/qr/sessions/<str:code>/status', api_views.get_status),
    path('api/qr/sessions/<str:code>/join', api_views.mobile_join),
    path('api/qr/sessions/<str:code>/approve', api_views.mobile_approve),
    path('api/qr/sessions/<str:code>/reject', api_views.mobile_reject),
    path('api/qr/sessions/<str:code>/photos-upload', api_views.photos_upload),
    path('api/qr/sessions/<str:code>/photos', api_views.add_photo),
    path('api/qr/sessions/<str:code>/ack', api_views.desktop_ack),
    path('api/qr/sessions/<str:code>/complete', api_views.desktop_complete),
    path('api/qr/sessions/<str:code>/signal', api_views.send_signal),
    path('api/qr/sessions/<str:code>/signals', api_views.poll_signals),

    # ===== 上传文件下载 =====
    re_path(r'^uploads/(?P<path>.+)$', api_views.serve_upload),

    # ===== 前端静态资源 =====
    re_path(r'^assets/(?P<path>.+)$', serve_static),
    re_path(r'^(?P<path>favicon\.ico)$', serve_static),

    # ===== SPA fallback（/ 和 /m/:code 等）=====
    path('', serve_index),
    re_path(r'^m/[^/]+$', serve_index),
    re_path(r'^.*$', serve_index),
]
