// JWT 持久化工具（localStorage）
const TOKEN_KEY = 'photo-transfer-token';

export function getToken(): string | null {
  try { return localStorage.getItem(TOKEN_KEY); } catch { return null; }
}
export function setToken(token: string): void {
  try { localStorage.setItem(TOKEN_KEY, token); } catch {}
}
export function clearToken(): void {
  try { localStorage.removeItem(TOKEN_KEY); } catch {}
}

export interface AuthUser {
  id: string;
  username: string;
  permanent_code: string;
  shop_name: string | null;
}

// 从 JWT payload 中快速拿 username（不用请求后端）
export function parseTokenPayload(token: string | null): { uid: string; username: string } | null {
  if (!token) return null;
  try {
    const parts = token.split('.');
    if (parts.length !== 3) return null;
    let body = parts[1].replace(/-/g, '+').replace(/_/g, '/');
    while (body.length % 4) body += '=';
    const payload = JSON.parse(decodeURIComponent(atob(body).split('').map(c =>
      '%' + ('00' + c.charCodeAt(0).toString(16)).slice(-2)
    ).join('')));
    return { uid: payload.uid, username: payload.username };
  } catch {
    return null;
  }
}
