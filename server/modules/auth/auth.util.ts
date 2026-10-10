import crypto from 'crypto';

// ============== 密码哈希（pbkdf2 + sha256） ==============
export function hashPassword(password: string, salt?: string): { hash: string; salt: string } {
  const s = salt || crypto.randomBytes(16).toString('hex');
  const h = crypto.pbkdf2Sync(password, s, 100000, 32, 'sha256').toString('hex');
  return { hash: h, salt: s };
}

export function verifyPassword(password: string, hash: string, salt: string): boolean {
  const { hash: expected } = hashPassword(password, salt);
  return crypto.timingSafeEqual(Buffer.from(expected, 'hex'), Buffer.from(hash, 'hex'));
}

// ============== JWT（HS256，手动实现） ==============
// 环境变量 JWT_SECRET 或默认值（生产环境务必设置）
const JWT_SECRET = process.env.JWT_SECRET || 'photo-transfer-dev-secret-change-me';
const JWT_EXPIRE_SECONDS = 7 * 24 * 3600; // 7 天

function base64urlEncode(buf: Buffer): string {
  return buf.toString('base64').replace(/=/g, '').replace(/\+/g, '-').replace(/\//g, '_');
}

function base64urlDecode(s: string): Buffer {
  s = s.replace(/-/g, '+').replace(/_/g, '/');
  while (s.length % 4) s += '=';
  return Buffer.from(s, 'base64');
}

export interface JwtPayload {
  uid: string;
  username: string;
}

export function signToken(payload: JwtPayload): string {
  const header = base64urlEncode(Buffer.from(JSON.stringify({ alg: 'HS256', typ: 'JWT' })));
  const body = base64urlEncode(Buffer.from(JSON.stringify({ ...payload, exp: Math.floor(Date.now() / 1000) + JWT_EXPIRE_SECONDS })));
  const data = `${header}.${body}`;
  const sig = base64urlEncode(crypto.createHmac('sha256', JWT_SECRET).update(data).digest());
  return `${data}.${sig}`;
}

export function verifyToken(token: string): JwtPayload | null {
  try {
    const parts = token.split('.');
    if (parts.length !== 3) return null;
    const [header, body, sig] = parts;
    const expectedSig = base64urlEncode(crypto.createHmac('sha256', JWT_SECRET).update(`${header}.${body}`).digest());
    if (sig !== expectedSig) return null;
    const payload = JSON.parse(base64urlDecode(body).toString());
    if (payload.exp && payload.exp < Math.floor(Date.now() / 1000)) return null;
    return { uid: payload.uid, username: payload.username };
  } catch {
    return null;
  }
}

// ============== 随机码 ==============
export function randomHex(len = 16): string {
  return crypto.randomBytes(len).toString('hex');
}

// 生成永久码：8 位小写字母数字
export function generatePermanentCode(): string {
  const chars = 'abcdefghijkmnpqrstuvwxyz23456789'; // 去掉易混淆的 0/O/1/l
  let code = '';
  const bytes = crypto.randomBytes(8);
  for (let i = 0; i < 8; i++) code += chars[bytes[i] % chars.length];
  return code;
}
