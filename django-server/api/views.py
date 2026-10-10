"""核心 views —— 1:1 复刻原 NestJS API 的所有端点和响应格式"""
import json
import os
import secrets
import time
import uuid
from django.db import IntegrityError
from django.http import JsonResponse, HttpResponse, Http404
from django.views.decorators.csrf import csrf_exempt
from django.views.decorators.http import require_http_methods
from django.conf import settings
from pathlib import Path

from .models import User, QrSession, QrPhoto, QrSignal
from .auth_utils import (
    hash_password, verify_password, sign_token, verify_token,
    generate_permanent_code,
)

TEN_MINUTES_MS = 10 * 60 * 1000


def _now_ms():
    return int(time.time() * 1000)


def _json_error(msg, status=400):
    return JsonResponse({'success': False, 'message': msg}, status=status)


def _json_ok(data=None, message='OK'):
    return JsonResponse({'success': True, 'data': data, 'message': message})


def _get_origin(request):
    proto = request.headers.get('X-Forwarded-Proto') or request.scheme or 'https'
    host = request.headers.get('X-Forwarded-Host') or request.get_host()
    return f'{proto}://{host}'


def _read_json(request):
    """安全读取 JSON body"""
    try:
        return json.loads(request.body.decode())
    except Exception:
        return {}


def _extract_jwt(request):
    auth = request.headers.get('Authorization', '')
    if auth.startswith('Bearer '):
        return auth[7:]
    return None


# ================================================================
# 认证端点
# ================================================================

@csrf_exempt
@require_http_methods(['POST'])
def auth_register(request):
    body = _read_json(request)
    username = (body.get('username') or '').strip().lower()
    password = body.get('password') or ''
    shop_name = (body.get('shopName') or body.get('shop_name') or '').strip() or None

    if len(username) < 3:
        return _json_error('用户名至少 3 个字符', 400)
    if len(password) < 6:
        return _json_error('密码至少 6 个字符', 400)

    if User.objects.filter(username=username).exists():
        return _json_error('用户名已存在', 409)

    pwd_hash, pwd_salt = hash_password(password)
    # 确保永久码唯一
    for _ in range(5):
        pc = generate_permanent_code()
        if not User.objects.filter(permanent_code=pc).exists():
            break

    user = User.objects.create(
        id=uuid.uuid4().hex,
        username=username,
        password_hash=pwd_hash,
        password_salt=pwd_salt,
        permanent_code=pc,
        shop_name=shop_name,
        created_at=_now_ms(),
    )
    token = sign_token(user.id, user.username)
    user_data = {
        'id': user.id,
        'username': user.username,
        'permanent_code': user.permanent_code,
        'shop_name': user.shop_name,
    }
    return JsonResponse({'token': token, 'user': user_data})


@csrf_exempt
@require_http_methods(['POST'])
def auth_login(request):
    body = _read_json(request)
    username = (body.get('username') or '').strip().lower()
    password = body.get('password') or ''

    try:
        user = User.objects.get(username=username)
    except User.DoesNotExist:
        return _json_error('用户名或密码错误', 401)

    if not verify_password(password, user.password_hash, user.password_salt):
        return _json_error('用户名或密码错误', 401)

    token = sign_token(user.id, user.username)
    user_data = {
        'id': user.id,
        'username': user.username,
        'permanent_code': user.permanent_code,
        'shop_name': user.shop_name,
    }
    return JsonResponse({'token': token, 'user': user_data})


@csrf_exempt
@require_http_methods(['GET'])
def auth_me(request):
    token = _extract_jwt(request)
    if not token:
        return JsonResponse(None, status=200)
    payload = verify_token(token)
    if not payload:
        return JsonResponse(None, status=200)
    try:
        user = User.objects.get(id=payload['uid'])
    except User.DoesNotExist:
        return JsonResponse(None, status=200)
    return JsonResponse({
        'id': user.id,
        'username': user.username,
        'permanent_code': user.permanent_code,
        'shop_name': user.shop_name,
    })


# ================================================================
# 二维码传输端点
# ================================================================

def _generate_code():
    """6 位数字会话码"""
    first = secrets.randbelow(9) + 1
    rest = ''.join(str(secrets.randbelow(10)) for _ in range(5))
    return str(first) + rest


def _generate_token():
    return secrets.token_hex(16)


def _session_to_info(s: QrSession):
    return {
        'code': s.code,
        'status': s.status,
        'expiresAt': __import__('datetime').datetime.utcfromtimestamp(s.expires_at / 1000).isoformat() + 'Z',
        'totalPhotos': s.total_photos,
        'receivedPhotos': s.received_photos,
    }


def _photo_to_info(p: QrPhoto):
    return {
        'id': p.id,
        'fileName': p.file_name,
        'fileSize': p.file_size,
        'downloadUrl': p.download_url,
        'status': p.status,
        'sortOrder': p.sort_order,
    }


@csrf_exempt
@require_http_methods(['POST'])
def create_session(request):
    origin = _get_origin(request)
    jwt_token = _extract_jwt(request)

    user_id = None
    if jwt_token:
        payload = verify_token(jwt_token)
        if payload:
            user_id = payload['uid']

    now = _now_ms()
    for _ in range(5):
        code = _generate_code()
        try:
            QrSession.objects.create(
                id=uuid.uuid4().hex,
                user_id=user_id,
                code=code,
                status='waiting',
                desktop_token=_generate_token(),
                expires_at=now + TEN_MINUTES_MS,
                _created_at=now,
                _updated_at=now,
            )
            mobile_url = f'{origin}/m/{code}'
            return JsonResponse({
                'success': True,
                'data': {
                    'code': code,
                    'desktopToken': QrSession.objects.get(code=code).desktop_token,
                    'mobileUrl': mobile_url,
                    'expiresAt': __import__('datetime').datetime.utcfromtimestamp((now + TEN_MINUTES_MS) / 1000).isoformat() + 'Z',
                },
                'message': '会话创建成功',
            })
        except IntegrityError:
            continue
    return _json_error('创建会话失败，请重试', 400)


@csrf_exempt
@require_http_methods(['POST'])
def create_from_permanent(request, permanent_code):
    try:
        user = User.objects.get(permanent_code=permanent_code)
    except User.DoesNotExist:
        return _json_error('该二维码不存在或已失效', 404)

    now = _now_ms()
    for _ in range(5):
        code = _generate_code()
        try:
            session = QrSession.objects.create(
                id=uuid.uuid4().hex,
                user=user,
                code=code,
                status='connected',
                desktop_token=_generate_token(),
                mobile_token=_generate_token(),
                expires_at=now + TEN_MINUTES_MS,
                _created_at=now,
                _updated_at=now,
            )
            return JsonResponse({
                'code': code,
                'mobileToken': session.mobile_token,
                'user': {
                    'username': user.username,
                    'shopName': user.shop_name,
                },
            })
        except IntegrityError:
            continue
    return _json_error('创建会话失败', 400)


@csrf_exempt
@require_http_methods(['GET'])
def get_status(request, code):
    desktop_token = request.GET.get('desktopToken', '')
    try:
        session = QrSession.objects.get(code=code)
    except QrSession.DoesNotExist:
        return _json_error('会话不存在', 404)

    photos = QrPhoto.objects.filter(session=session).order_by('sort_order')
    session_info = _session_to_info(session)
    photos_info = [_photo_to_info(p) for p in photos]
    return JsonResponse({
        'success': True,
        'data': {
            'session': session_info,
            'photos': photos_info,
            'desktopToken': session.desktop_token if desktop_token == session.desktop_token else None,
        },
    })


@csrf_exempt
@require_http_methods(['POST'])
def mobile_join(request, code):
    try:
        session = QrSession.objects.get(code=code)
    except QrSession.DoesNotExist:
        return _json_error('会话不存在', 404)

    if session.expires_at < _now_ms():
        return _json_error('会话已过期', 409)
    if session.status != 'waiting':
        return _json_error('会话状态不允许加入', 409)

    mobile_token = _generate_token()
    session.mobile_token = mobile_token
    session.status = 'connected'
    session.expires_at = _now_ms() + TEN_MINUTES_MS
    session._updated_at = _now_ms()
    session.save()

    return JsonResponse({
        'success': True,
        'data': {
            'session': _session_to_info(session),
            'mobileToken': mobile_token,
        },
        'message': '加入成功',
    })


@csrf_exempt
@require_http_methods(['POST'])
def mobile_approve(request, code):
    body = _read_json(request)
    mobile_token = body.get('mobileToken', '')
    total_photos = body.get('totalPhotos', 0)

    try:
        session = QrSession.objects.get(code=code, mobile_token=mobile_token)
    except QrSession.DoesNotExist:
        return _json_error('会话不存在或 mobileToken 错误', 404)

    if session.status not in ('connected', 'transferring'):
        return _json_error('会话状态不允许操作', 409)

    session.status = 'transferring'
    session.total_photos = total_photos
    session._updated_at = _now_ms()
    session.save()

    return JsonResponse({
        'success': True,
        'data': {'session': _session_to_info(session)},
    })


@csrf_exempt
@require_http_methods(['POST'])
def mobile_reject(request, code):
    body = _read_json(request)
    mobile_token = body.get('mobileToken', '')

    try:
        session = QrSession.objects.get(code=code, mobile_token=mobile_token)
    except QrSession.DoesNotExist:
        return _json_error('会话不存在', 404)

    session.status = 'rejected'
    session._updated_at = _now_ms()
    session.save()

    return JsonResponse({'success': True, 'message': '已拒绝'})


@csrf_exempt
@require_http_methods(['POST'])
def photos_upload(request, code):
    """multipart 文件上传"""
    try:
        session = QrSession.objects.get(code=code)
    except QrSession.DoesNotExist:
        return _json_error('会话不存在', 404)

    if 'file' not in request.FILES:
        return _json_error('No file uploaded', 400)

    uploaded = request.FILES['file']
    origin = _get_origin(request)

    # 保存到 uploads 目录
    save_dir = Path(settings.UPLOAD_DIR)
    save_dir.mkdir(parents=True, exist_ok=True)
    saved_name = f"{secrets.token_hex(8)}_{uploaded.name}"
    save_path = save_dir / saved_name
    with open(save_path, 'wb+') as f:
        for chunk in uploaded.chunks():
            f.write(chunk)

    file_name = request.POST.get('fileName', uploaded.name)
    file_size = int(request.POST.get('fileSize', uploaded.size))
    sort_order = int(request.POST.get('sortOrder', 0))
    download_url = f'{origin}/uploads/{saved_name}'

    photo = QrPhoto.objects.create(
        id=uuid.uuid4().hex,
        session=session,
        file_name=file_name,
        file_size=file_size,
        download_url=download_url,
        file_path=saved_name,
        status='ready',
        sort_order=sort_order,
        _created_at=_now_ms(),
        _updated_at=_now_ms(),
    )

    return JsonResponse({
        'success': True,
        'data': _photo_to_info(photo),
    })


@csrf_exempt
@require_http_methods(['POST'])
def add_photo(request, code):
    body = _read_json(request)
    try:
        session = QrSession.objects.get(code=code)
    except QrSession.DoesNotExist:
        return _json_error('会话不存在', 404)

    photo = QrPhoto.objects.create(
        id=uuid.uuid4().hex,
        session=session,
        file_name=body.get('fileName', ''),
        file_size=body.get('fileSize', 0),
        download_url=body.get('downloadUrl', ''),
        file_path=body.get('filePath'),
        bucket_id=body.get('bucketId'),
        status=body.get('status', 'uploading'),
        sort_order=body.get('sortOrder', 0),
        _created_at=_now_ms(),
        _updated_at=_now_ms(),
    )
    return JsonResponse({
        'success': True,
        'data': _photo_to_info(photo),
    })


@csrf_exempt
@require_http_methods(['POST'])
def desktop_ack(request, code):
    body = _read_json(request)
    desktop_token = body.get('desktopToken', '')
    photo_ids = body.get('photoIds', [])

    try:
        session = QrSession.objects.get(code=code, desktop_token=desktop_token)
    except QrSession.DoesNotExist:
        return _json_error('会话不存在或 desktopToken 错误', 404)

    QrPhoto.objects.filter(id__in=photo_ids, session=session).update(
        status='received', _updated_at=_now_ms(),
    )
    session.received_photos = QrPhoto.objects.filter(session=session, status='received').count()
    session._updated_at = _now_ms()
    session.save()

    return JsonResponse({
        'success': True,
        'data': {'session': _session_to_info(session)},
    })


@csrf_exempt
@require_http_methods(['POST'])
def desktop_complete(request, code):
    body = _read_json(request)
    desktop_token = body.get('desktopToken', '')

    try:
        session = QrSession.objects.get(code=code, desktop_token=desktop_token)
    except QrSession.DoesNotExist:
        return _json_error('会话不存在', 404)

    session.status = 'completed'
    session._updated_at = _now_ms()
    session.save()
    return JsonResponse({'success': True, 'message': '完成'})


# ================================================================
# WebRTC 信令
# ================================================================

@csrf_exempt
@require_http_methods(['POST'])
def send_signal(request, code):
    body = _read_json(request)
    role = body.get('role', '')  # desktop | mobile
    sig_type = body.get('type', '')  # offer | answer | ice
    payload = body.get('payload') or body.get('message') or {}

    QrSignal.objects.create(
        session_code=code,
        role=role,
        type=sig_type,
        payload=json.dumps(payload) if isinstance(payload, (dict, list)) else str(payload),
        created_at=_now_ms(),
    )

    # 拉取对方所有信令
    return _poll_signals_internal(code, None, _opposite_role(role))


def _opposite_role(role):
    return 'mobile' if role == 'desktop' else 'desktop'


@csrf_exempt
@require_http_methods(['GET'])
def poll_signals(request, code):
    token = request.GET.get('token', '')
    role = request.GET.get('role', '')
    return _poll_signals_internal(code, token, role)


def _poll_signals_internal(code, token, role):
    signals = QrSignal.objects.filter(session_code=code, role=role).order_by('created_at')
    items = [
        {
            'type': s.type,
            'payload': json.loads(s.payload) if s.payload.startswith('{') or s.payload.startswith('[') else s.payload,
        }
        for s in signals
    ]
    return JsonResponse({'success': True, 'data': {'signals': items}})


# ================================================================
# 上传文件下载
# ================================================================

def serve_upload(request, path):
    file_path = Path(settings.UPLOAD_DIR) / path
    if not file_path.exists():
        raise Http404()
    with open(file_path, 'rb') as f:
        resp = HttpResponse(f.read(), content_type='application/octet-stream')
        resp['Content-Disposition'] = f'attachment; filename="{file_path.name}"'
        return resp
