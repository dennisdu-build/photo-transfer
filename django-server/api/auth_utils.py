"""JWT + 密码哈希工具（纯 Python stdlib，零依赖，与 NestJS auth.util.ts 算法一致）"""
import base64
import hashlib
import hmac
import json
import os
import secrets
import time
from typing import Optional

JWT_SECRET = os.environ.get('JWT_SECRET', 'photo-transfer-dev-secret-change-me')
JWT_EXPIRE_SECONDS = 7 * 24 * 3600


def hash_password(password: str, salt: Optional[str] = None):
    """pbkdf2-sha256，100k 次迭代"""
    if salt is None:
        salt = secrets.token_hex(16)
    h = hashlib.pbkdf2_hmac('sha256', password.encode(), salt.encode(), 100000).hex()
    return h, salt


def verify_password(password: str, pwd_hash: str, salt: str) -> bool:
    h, _ = hash_password(password, salt)
    return hmac.compare_digest(h, pwd_hash)


def _b64url_encode(data: bytes) -> str:
    return base64.urlsafe_b64encode(data).rstrip(b'=').decode()


def _b64url_decode(s: str) -> bytes:
    s += '=' * (-len(s) % 4)
    return base64.urlsafe_b64decode(s)


def sign_token(uid: str, username: str) -> str:
    header = _b64url_encode(json.dumps({'alg': 'HS256', 'typ': 'JWT'}).encode())
    body = _b64url_encode(json.dumps({
        'uid': uid,
        'username': username,
        'exp': int(time.time()) + JWT_EXPIRE_SECONDS,
    }).encode())
    data = f'{header}.{body}'
    sig = _b64url_encode(hmac.new(JWT_SECRET.encode(), data.encode(), hashlib.sha256).digest())
    return f'{data}.{sig}'


def verify_token(token: str) -> Optional[dict]:
    try:
        parts = token.split('.')
        if len(parts) != 3:
            return None
        header, body, sig = parts
        expected_sig = _b64url_encode(hmac.new(JWT_SECRET.encode(), f'{header}.{body}'.encode(), hashlib.sha256).digest())
        if not hmac.compare_digest(sig, expected_sig):
            return None
        payload = json.loads(_b64url_decode(body))
        if payload.get('exp', 0) < int(time.time()):
            return None
        return payload  # { uid, username }
    except Exception:
        return None


def generate_permanent_code() -> str:
    """8 位小写字母数字，去掉易混淆字符"""
    chars = 'abcdefghijkmnpqrstuvwxyz23456789'
    return ''.join(secrets.choice(chars) for _ in range(8))
