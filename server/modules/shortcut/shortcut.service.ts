import { Inject, Injectable, BadRequestException, NotFoundException } from '@nestjs/common';
import crypto from 'crypto';
import type { Database } from 'sql.js';
import fs from 'fs';

import { SQLITE_DB, saveDb } from '@server/database/database.module';
import { verifyToken } from '../auth/auth.util';

function generateId(): string {
  return crypto.randomUUID();
}

function generateCode(): string {
  const first = Math.floor(Math.random() * 9) + 1;
  let rest = '';
  for (let i = 0; i < 5; i += 1) rest += Math.floor(Math.random() * 10).toString();
  return first + rest;
}

function generateToken(): string {
  return crypto.randomBytes(16).toString('hex');
}

const BACKUP_TIMEOUT_MS = 2 * 60 * 60 * 1000; // Shortcuts 备份给 2 小时（比普通 session 10 分钟长很多）

interface CreateResult {
  success: boolean;
  data: {
    code: string;
    mobileToken: string;
    shortcutId: string;
    uploadUrl: string;
    configUrl: string;
    completeUrl: string;
    serverUrl: string;
    expiresAt: string;
  };
  message: string;
}

@Injectable()
export class ShortcutsService {
  constructor(@Inject(SQLITE_DB) private readonly db: Database) {}

  async createSession(origin: string, jwtToken?: string): Promise<CreateResult> {
    if (!jwtToken) {
      throw new BadRequestException('需要登录后才能使用快捷指令备份');
    }
    const payload = verifyToken(jwtToken);
    if (!payload) throw new BadRequestException('登录已过期');
    const userId = payload.uid;

    const now = Date.now();
    const expiresAt = now + BACKUP_TIMEOUT_MS;

    // 1. 创建 qr_sessions（relayEnabled = user_id，Shortcuts 上传走服务器中继）
    let code = '';
    let desktopToken = '';
    let mobileToken = '';
    for (let attempt = 0; attempt < 10; attempt += 1) {
      code = generateCode();
      desktopToken = generateToken();
      mobileToken = generateToken();
      const id = generateId();
      try {
        this.db.run(
          `INSERT INTO qr_sessions
           (id, user_id, code, desktop_token, mobile_token, expires_at, status, total_photos, received_photos, _created_at, _updated_at)
           VALUES (?, ?, ?, ?, ?, ?, 'connected', 0, 0, ?, ?)`,
          [id, userId, code, desktopToken, mobileToken, expiresAt, now, now],
        );
        break;
      } catch {
        continue;
      }
    }

    // 2. 创建 shortcut 专属表记录（用 TEXT 表存，简单）
    const shortcutId = generateToken();
    this.db.run(
      `INSERT OR REPLACE INTO shortcut_backups (shortcut_id, session_code, mobile_token, status, _created_at)
       VALUES (?, ?, ?, 'running', ?)`,
      [shortcutId, code, mobileToken, now],
    );
    saveDb(this.db);

    const uploadUrl = `${origin}/api/shortcut/upload/${shortcutId}`;
    const configUrl = `${origin}/api/shortcut/config/${shortcutId}`;
    const completeUrl = `${origin}/api/shortcut/complete/${shortcutId}`;

    return {
      success: true,
      data: {
        code,
        mobileToken,
        shortcutId,
        uploadUrl,
        configUrl,
        completeUrl,
        serverUrl: origin,
        expiresAt: new Date(expiresAt).toISOString(),
      },
      message: 'Shortcuts 备份会话创建成功',
    };
  }

  getConfig(shortcutId: string, origin: string) {
    const rows = this.db.exec(
      'SELECT session_code, mobile_token FROM shortcut_backups WHERE shortcut_id = ?',
      [shortcutId],
    );
    if (!rows.length || !rows[0].values.length) {
      throw new NotFoundException('备份会话不存在');
    }
    const [code, mobileToken] = rows[0].values[0] as [string, string];

    return {
      code,
      mobileToken,
      uploadUrl: `${origin}/api/shortcut/upload/${shortcutId}`,
      completeUrl: `${origin}/api/shortcut/complete/${shortcutId}`,
    };
  }

  addPhoto(params: {
    shortcutId: string;
    file: Express.Multer.File;
    fileName: string;
    fileSize: number;
    sortOrder: number;
    origin: string;
  }) {
    const { shortcutId, file, fileName, fileSize, sortOrder, origin } = params;

    // 1. 查 session_code
    const backupRows = this.db.exec(
      'SELECT session_code FROM shortcut_backups WHERE shortcut_id = ?',
      [shortcutId],
    );
    if (!backupRows.length || !backupRows[0].values.length) {
      throw new NotFoundException('备份会话不存在');
    }
    const code = backupRows[0].values[0][0] as string;

    // 2. 确认 session 存在 + 刷新 expires
    const sessionRows = this.db.exec(
      'SELECT id FROM qr_sessions WHERE code = ?',
      [code],
    );
    if (!sessionRows.length || !sessionRows[0].values.length) {
      throw new NotFoundException('会话不存在');
    }
    const sessionId = sessionRows[0].values[0][0] as string;

    const filePath = `/uploads/${file.filename}`;
    const downloadUrl = `${origin}${filePath}`;

    // 3. 写入 qr_photos
    const id = generateId();
    const now = Date.now();
    this.db.run(
      `INSERT INTO qr_photos
       (id, session_id, file_name, file_size, download_url, file_path, status, sort_order, _created_at, _updated_at)
       VALUES (?, ?, ?, ?, ?, ?, 'ready', ?, ?, ?)`,
      [id, sessionId, fileName, fileSize, downloadUrl, file.filename, sortOrder, now, now],
    );

    // 4. 更新 session 计数 + 刷新 expires
    this.db.run(
      `UPDATE qr_sessions SET
         total_photos = total_photos + 1,
         received_photos = received_photos + 1,
         expires_at = ?,
         _updated_at = ?
       WHERE id = ?`,
      [Date.now() + 30 * 60 * 1000, now, sessionId], // 每次上传续 30 分钟
    );
    saveDb(this.db);

    return { success: true, id, fileName, downloadUrl };
  }

  markComplete(shortcutId: string) {
    const rows = this.db.exec(
      'SELECT session_code FROM shortcut_backups WHERE shortcut_id = ?',
      [shortcutId],
    );
    if (!rows.length || !rows[0].values.length) {
      throw new NotFoundException('备份会话不存在');
    }
    const code = rows[0].values[0][0] as string;
    const now = Date.now();

    this.db.run("UPDATE shortcut_backups SET status='done', _updated_at=? WHERE shortcut_id=?", [now, shortcutId]);
    this.db.run("UPDATE qr_sessions SET status='completed', expires_at=?, _updated_at=? WHERE code=?", [now, now, code]);
    saveDb(this.db);

    return { success: true, code, message: 'Shortcuts 备份已标记完成' };
  }
}
