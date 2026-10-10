import { Inject } from '@nestjs/common';
import {
  BadRequestException,
  ConflictException,
  ForbiddenException,
  NotFoundException,
  Injectable,
} from '@nestjs/common';
import crypto from 'crypto';
import type { Database } from 'sql.js';

import { SQLITE_DB, saveDb } from '@server/database/database.module';
import { verifyToken } from '../auth/auth.util';

import type {
  QrSessionInfo,
  QrPhotoInfo,
  QrSessionStatus,
  CreateSessionResponse,
  SessionStatusResponse,
  MobileJoinResponse,
  MobileApproveRequest,
  MobileRejectRequest,
  PhotoUploadRequest,
  PhotoUploadResponse,
  DesktopAckRequest,
  DesktopCompleteRequest,
  SimpleResponse,
  SignalRequest,
  SignalResponse,
  SignalMessage,
} from '@shared/api.interface';

function generateCode(): string {
  const first = Math.floor(Math.random() * 9) + 1;
  let rest = '';
  for (let i = 0; i < 5; i += 1) {
    rest += Math.floor(Math.random() * 10).toString();
  }
  return first + rest;
}

function generateToken(): string {
  return crypto.randomBytes(16).toString('hex');
}

function generateId(): string {
  return crypto.randomUUID();
}

interface SessionRow {
  id: string; code: string; status: QrSessionStatus; desktop_token: string;
  mobile_token: string | null; expires_at: number; total_photos: number;
  received_photos: number; user_id: string | null;
  _created_at: number; _updated_at: number;
}

interface PhotoRow {
  id: string; session_id: string; file_name: string; file_size: number;
  download_url: string; file_path: string | null; bucket_id: string | null;
  status: 'uploading' | 'ready' | 'received'; sort_order: number;
  _created_at: number; _updated_at: number;
}

function isExpired(s: SessionRow): boolean {
  return s.expires_at < Date.now();
}

function toSessionInfo(s: SessionRow): QrSessionInfo {
  return {
    code: s.code,
    status: s.status,
    expiresAt: new Date(s.expires_at).toISOString(),
    totalPhotos: s.total_photos,
    receivedPhotos: s.received_photos,
    /** 🔑 用户分层标记：有 user_id = 登录用户创建的会话 = 启用服务器中继；否则强制纯 P2P */
    relayEnabled: !!s.user_id,
  };
}

function toPhotoInfo(p: PhotoRow): QrPhotoInfo {
  return {
    id: p.id,
    fileName: p.file_name,
    fileSize: p.file_size,
    downloadUrl: p.download_url,
    status: p.status,
    sortOrder: p.sort_order,
    createdAt: new Date(p._created_at).toISOString(),
  };
}

const TEN_MINUTES_MS = 10 * 60 * 1000;

function all<T>(db: Database, sql: string, params: unknown[] = []): T[] {
  const stmt = db.prepare(sql);
  stmt.bind(params);
  const rows: T[] = [];
  while (stmt.step()) rows.push(stmt.getAsObject() as T);
  stmt.free();
  return rows;
}

function get<T>(db: Database, sql: string, params: unknown[] = []): T | undefined {
  const rows = all<T>(db, sql, params);
  return rows[0];
}

@Injectable()
export class QrTransferService {
  constructor(
    @Inject(SQLITE_DB) private readonly db: Database,
  ) {}

  async createSession(origin: string, jwtToken?: string): Promise<CreateSessionResponse> {
    let code = '';
    const maxAttempts = 5;
    const now = Date.now();

    // 解析 JWT 关联 user_id
    let userId: string | undefined;
    if (jwtToken) {
      const payload = verifyToken(jwtToken);
      if (payload) userId = payload.uid;
    }

    for (let attempt = 0; attempt < maxAttempts; attempt += 1) {
      code = generateCode();
      const desktopToken = generateToken();
      const expiresAt = now + TEN_MINUTES_MS;
      const id = generateId();

      try {
        if (userId) {
          this.db.run(
            `INSERT INTO qr_sessions (id, user_id, code, desktop_token, expires_at, status, _created_at, _updated_at)
             VALUES (?, ?, ?, ?, ?, 'waiting', ?, ?)`,
            [id, userId, code, desktopToken, expiresAt, now, now],
          );
        } else {
          this.db.run(
            `INSERT INTO qr_sessions (id, code, desktop_token, expires_at, status, _created_at, _updated_at)
             VALUES (?, ?, ?, ?, 'waiting', ?, ?)`,
            [id, code, desktopToken, expiresAt, now, now],
          );
        }
        saveDb(this.db);

        const mobileUrl = `${origin}/m/${code}`;
        return {
          success: true,
          data: {
            code, desktopToken, mobileUrl,
            expiresAt: new Date(expiresAt).toISOString(),
          },
          message: '会话创建成功',
        };
      } catch {
        continue; // code 重复，重试
      }
    }

    throw new BadRequestException('创建会话失败，请重试');
  }

  /** 通过永久码创建会话（打印店场景：客人扫码 → 自动为该老板创建临时会话） */
  async createSessionFromPermanentCode(permanentCode: string): Promise<{
    code: string;
    mobileToken: string;
    user: { username: string; shopName: string | null };
  }> {
    // 1. 查用户
    const userRows = this.db.exec(
      'SELECT id, username, shop_name FROM users WHERE permanent_code = ?',
      [permanentCode],
    );
    if (!userRows.length || !userRows[0].values.length) {
      throw new NotFoundException('该二维码不存在或已失效');
    }
    const [userId, username, shopName] = userRows[0].values[0] as [string, string, string | null];

    // 2. 创建会话并自动 mobileJoin（客人直接进入）
    let code = '';
    for (let attempt = 0; attempt < 5; attempt += 1) {
      code = generateCode();
      const desktopToken = generateToken();
      const mobileToken = generateToken();
      const now = Date.now();
      const expiresAt = now + TEN_MINUTES_MS;
      const id = generateId();

      try {
        this.db.run(
          `INSERT INTO qr_sessions (id, user_id, code, desktop_token, mobile_token, expires_at, status, _created_at, _updated_at)
           VALUES (?, ?, ?, ?, ?, ?, 'connected', ?, ?)`,
          [id, userId, code, desktopToken, mobileToken, expiresAt, now, now],
        );
        saveDb(this.db);
        return { code, mobileToken, user: { username, shopName } };
      } catch {
        continue;
      }
    }
    throw new BadRequestException('创建会话失败');
  }

  async getStatus(code: string, desktopToken?: string): Promise<SessionStatusResponse> {
    const session = this.findSessionByCode(code);
    if (!session) throw new NotFoundException('会话不存在');

    if (isExpired(session)) {
      if (session.status !== 'expired') {
        this.db.run("UPDATE qr_sessions SET status='expired', _updated_at=? WHERE id=?", [Date.now(), session.id]);
        saveDb(this.db);
        session.status = 'expired';
      }
    }

    if (desktopToken !== undefined && session.desktop_token !== desktopToken) {
      throw new ForbiddenException('token 不匹配');
    }

    return this.buildStatusResponse(session);
  }

  async mobileJoin(code: string): Promise<MobileJoinResponse> {
    const session = this.findSessionByCode(code);
    if (!session) throw new NotFoundException('会话不存在');
    if (isExpired(session)) throw new ConflictException('会话已过期');
    if (session.status !== 'waiting') throw new ConflictException('会话状态不允许加入');

    const mobileToken = generateToken();
    const expiresAt = Date.now() + TEN_MINUTES_MS;

    this.db.run(
      `UPDATE qr_sessions SET mobile_token=?, status='connected', expires_at=?, _updated_at=? WHERE id=?`,
      [mobileToken, expiresAt, Date.now(), session.id],
    );
    saveDb(this.db);

    const updated = this.findSessionByCode(code)!;
    return {
      success: true,
      data: { session: toSessionInfo(updated), mobileToken },
      message: '加入成功',
    };
  }

  async mobileApprove(dto: MobileApproveRequest): Promise<SessionStatusResponse> {
    const session = this.findAndValidateMobile(dto.code, dto.mobileToken);
    if (session.status !== 'connected' && session.status !== 'transferring') {
      throw new ConflictException('会话状态不允许批准');
    }

    const expiresAt = Date.now() + TEN_MINUTES_MS;
    // connected → transferring；transferring → 保持不变但更新 total_photos
    const newStatus = session.status === 'connected' ? 'transferring' : session.status;
    this.db.run(
      `UPDATE qr_sessions SET status=?, total_photos=?, expires_at=?, _updated_at=? WHERE id=?`,
      [newStatus, dto.totalPhotos, expiresAt, Date.now(), session.id],
    );
    saveDb(this.db);

    const updated = this.findSessionByCode(dto.code)!;
    return this.buildStatusResponse(updated);
  }

  async mobileReject(dto: MobileRejectRequest): Promise<SimpleResponse> {
    const session = this.findAndValidateMobile(dto.code, dto.mobileToken);
    if (session.status !== 'waiting' && session.status !== 'connected') {
      throw new ConflictException('会话状态不允许拒绝');
    }

    this.db.run("UPDATE qr_sessions SET status='rejected', _updated_at=? WHERE id=?", [Date.now(), session.id]);
    saveDb(this.db);
    return { success: true, message: '已拒绝连接' };
  }

  async addPhoto(dto: PhotoUploadRequest): Promise<PhotoUploadResponse> {
    const session = this.findAndValidateMobile(dto.code, dto.mobileToken);
    const now = Date.now();

    this.db.run(
      `INSERT INTO qr_photos (id, session_id, file_name, file_size, download_url, file_path, bucket_id,
       status, sort_order, _created_at, _updated_at)
       VALUES (?, ?, ?, ?, ?, ?, ?, 'ready', ?, ?, ?)`,
      [generateId(), session.id, dto.fileName, dto.fileSize, dto.downloadUrl,
       dto.filePath ?? null, dto.bucketId ?? null, dto.sortOrder ?? 0, now, now],
    );

    // 刷新会话过期时间
    const expiresAt = Date.now() + TEN_MINUTES_MS;
    this.db.run(
      "UPDATE qr_sessions SET expires_at=?, _updated_at=? WHERE id=?",
      [expiresAt, Date.now(), session.id],
    );
    saveDb(this.db);

    const photo = get<PhotoRow>(this.db,
      "SELECT * FROM qr_photos WHERE session_id=? ORDER BY _created_at DESC LIMIT 1",
      [session.id],
    );

    return { success: true, data: toPhotoInfo(photo!), message: '照片上报成功' };
  }

  async desktopAck(dto: DesktopAckRequest): Promise<SessionStatusResponse> {
    const session = this.findAndValidateDesktop(dto.code, dto.desktopToken);

    if (dto.photoIds && dto.photoIds.length > 0) {
      const placeholders = dto.photoIds.map(() => '?').join(',');
      this.db.run(
        `UPDATE qr_photos SET status='received' WHERE session_id=? AND id IN (${placeholders})`,
        [session.id, ...dto.photoIds],
      );
    }

    const countRow = get<{ c: number }>(this.db,
      "SELECT COUNT(*) as c FROM qr_photos WHERE session_id=? AND status='received'",
      [session.id],
    );
    const receivedCount = countRow?.c ?? 0;

    const expiresAt = Date.now() + TEN_MINUTES_MS;
    this.db.run(
      "UPDATE qr_sessions SET received_photos=?, expires_at=?, _updated_at=? WHERE id=?",
      [receivedCount, expiresAt, Date.now(), session.id],
    );
    saveDb(this.db);

    const updated = this.findSessionByCode(dto.code)!;
    return this.buildStatusResponse(updated);
  }

  async desktopComplete(dto: DesktopCompleteRequest): Promise<SimpleResponse> {
    const session = this.findAndValidateDesktop(dto.code, dto.desktopToken);
    this.db.run("UPDATE qr_sessions SET status='completed', _updated_at=? WHERE id=?", [Date.now(), session.id]);
    saveDb(this.db);
    return { success: true, message: '会话已完成' };
  }

  // ============ WebRTC 信令 ============

  /** 发送一条信令消息，同时拉取对方发来的所有消息 */
  async sendSignal(dto: SignalRequest): Promise<SignalResponse> {
    // 校验会话存在
    const session = this.findSessionByCode(dto.code);
    if (!session) throw new NotFoundException('会话不存在');

    // 根据 role 校验 token
    if (dto.role === 'desktop') {
      if (session.desktop_token !== dto.token) throw new ForbiddenException('desktopToken 不匹配');
    } else {
      if (!session.mobile_token || session.mobile_token !== dto.token) {
        throw new ForbiddenException('mobileToken 不匹配');
      }
    }

    // 写入信令
    this.db.run(
      `INSERT INTO qr_signals (id, session_code, role, type, payload, created_at)
       VALUES (?, ?, ?, ?, ?, ?)`,
      [generateId(), dto.code, dto.message.role, dto.message.type, dto.message.payload, Date.now()],
    );

    // 拉取对方发来的所有消息
    const otherRole = dto.role === 'desktop' ? 'mobile' : 'desktop';
    const rows = all<{ type: string; role: string; payload: string }>(
      this.db,
      "SELECT type, role, payload FROM qr_signals WHERE session_code=? AND role=? ORDER BY created_at ASC",
      [dto.code, otherRole],
    );

    saveDb(this.db);

    return {
      success: true,
      messages: rows.map((r) => ({
        type: r.type as SignalMessage['type'],
        role: r.role as SignalMessage['role'],
        payload: r.payload,
      })),
    };
  }

  /** 仅拉取对方发来的所有信令消息（用于轮询） */
  async pollSignals(code: string, token: string, role: 'desktop' | 'mobile'): Promise<SignalResponse> {
    const session = this.findSessionByCode(code);
    if (!session) throw new NotFoundException('会话不存在');

    if (role === 'desktop') {
      if (session.desktop_token !== token) throw new ForbiddenException('desktopToken 不匹配');
    } else {
      if (!session.mobile_token || session.mobile_token !== token) {
        throw new ForbiddenException('mobileToken 不匹配');
      }
    }

    const otherRole = role === 'desktop' ? 'mobile' : 'desktop';
    const rows = all<{ type: string; role: string; payload: string }>(
      this.db,
      "SELECT type, role, payload FROM qr_signals WHERE session_code=? AND role=? ORDER BY created_at ASC",
      [code, otherRole],
    );

    return {
      success: true,
      messages: rows.map((r) => ({
        type: r.type as SignalMessage['type'],
        role: r.role as SignalMessage['role'],
        payload: r.payload,
      })),
    };
  }

  // --- private helpers ---

  private findSessionByCode(code: string): SessionRow | undefined {
    return get<SessionRow>(this.db, "SELECT * FROM qr_sessions WHERE code=?", [code]);
  }

  private findAndValidateMobile(code: string, mobileToken: string): SessionRow {
    const session = this.findSessionByCode(code);
    if (!session) throw new NotFoundException('会话不存在');
    if (isExpired(session)) throw new ConflictException('会话已过期');
    if (!session.mobile_token || session.mobile_token !== mobileToken) {
      throw new ForbiddenException('mobileToken 不匹配');
    }
    return session;
  }

  private findAndValidateDesktop(code: string, desktopToken: string): SessionRow {
    const session = this.findSessionByCode(code);
    if (!session) throw new NotFoundException('会话不存在');
    if (isExpired(session)) throw new ConflictException('会话已过期');
    if (session.desktop_token !== desktopToken) {
      throw new ForbiddenException('desktopToken 不匹配');
    }
    return session;
  }

  private buildStatusResponse(session: SessionRow): SessionStatusResponse {
    const photos = all<PhotoRow>(this.db,
      "SELECT * FROM qr_photos WHERE session_id=? ORDER BY sort_order",
      [session.id],
    );
    return {
      success: true,
      data: {
        session: toSessionInfo(session),
        photos: photos.map(toPhotoInfo),
      },
      message: 'ok',
    };
  }
}
