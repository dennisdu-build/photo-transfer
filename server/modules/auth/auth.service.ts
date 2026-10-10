import { Injectable, UnauthorizedException, ConflictException, BadRequestException } from '@nestjs/common';
import type { Database } from 'sql.js';
import { SQLITE_DB } from '@server/database/database.module';
import { Inject } from '@nestjs/common';
import { hashPassword, verifyPassword, signToken, verifyToken, generatePermanentCode, type JwtPayload } from './auth.util';

export interface AuthUser {
  id: string;
  username: string;
  permanent_code: string;
  shop_name: string | null;
}

@Injectable()
export class AuthService {
  constructor(@Inject(SQLITE_DB) private readonly db: Database) {}

  register(username: string, password: string, shopName?: string): { token: string; user: AuthUser } {
    username = username.trim().toLowerCase();
    const EMAIL_RE = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
    if (!EMAIL_RE.test(username)) throw new BadRequestException('请输入有效的邮箱地址');
    if (!password || password.length < 6) throw new BadRequestException('密码至少 6 个字符');

    // 检查用户名重复
    const existing = this.db.exec('SELECT id FROM users WHERE username = ?', [username]);
    if (existing.length > 0 && existing[0].values.length > 0) {
      throw new ConflictException('用户名已存在');
    }

    const { hash, salt } = hashPassword(password);
    const id = crypto.randomUUID();
    let permanentCode = generatePermanentCode();
    // 确保永久码唯一（理论上 8 位有 2.8 亿种，极难碰撞，但保险）
    for (let i = 0; i < 5; i++) {
      const dup = this.db.exec('SELECT id FROM users WHERE permanent_code = ?', [permanentCode]);
      if (dup.length === 0 || dup[0].values.length === 0) break;
      permanentCode = generatePermanentCode();
    }

    const now = Date.now();
    this.db.run(
      'INSERT INTO users (id, username, password_hash, password_salt, permanent_code, shop_name, created_at) VALUES (?,?,?,?,?,?,?)',
      [id, username, hash, salt, permanentCode, shopName || null, now],
    );

    const user: AuthUser = { id, username, permanent_code: permanentCode, shop_name: shopName || null };
    const token = signToken({ uid: id, username });
    return { token, user };
  }

  login(username: string, password: string): { token: string; user: AuthUser } {
    username = username.trim().toLowerCase();
    const EMAIL_RE = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
    if (!EMAIL_RE.test(username)) throw new BadRequestException('请输入有效的邮箱地址');
    if (!password || password.length < 6) throw new BadRequestException('密码至少 6 位');
    const rows = this.db.exec(
      'SELECT id, username, password_hash, password_salt, permanent_code, shop_name FROM users WHERE username = ?',
      [username],
    );
    if (!rows.length || !rows[0].values.length) {
      throw new UnauthorizedException('用户名或密码错误');
    }
    const [id, uname, pwdHash, pwdSalt, permCode, shop] = rows[0].values[0] as [string, string, string, string, string, string | null];
    if (!verifyPassword(password, pwdHash, pwdSalt)) {
      throw new UnauthorizedException('用户名或密码错误');
    }
    const user: AuthUser = { id, username: uname, permanent_code: permCode, shop_name: shop };
    const token = signToken({ uid: id, username: uname });
    return { token, user };
  }

  findById(id: string): AuthUser | null {
    const rows = this.db.exec(
      'SELECT id, username, permanent_code, shop_name FROM users WHERE id = ?',
      [id],
    );
    if (!rows.length || !rows[0].values.length) return null;
    const [uid, uname, permCode, shop] = rows[0].values[0] as [string, string, string, string | null];
    return { id: uid, username: uname, permanent_code: permCode, shop_name: shop };
  }

  findByPermanentCode(code: string): AuthUser | null {
    const rows = this.db.exec(
      'SELECT id, username, permanent_code, shop_name FROM users WHERE permanent_code = ?',
      [code],
    );
    if (!rows.length || !rows[0].values.length) return null;
    const [uid, uname, permCode, shop] = rows[0].values[0] as [string, string, string, string | null];
    return { id: uid, username: uname, permanent_code: permCode, shop_name: shop };
  }

  meFromToken(token: string): AuthUser | null {
    const payload = verifyToken(token);
    if (!payload) return null;
    return this.findById(payload.uid);
  }
}
