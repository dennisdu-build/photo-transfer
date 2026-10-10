import { Module, Global, Provider, OnModuleInit } from '@nestjs/common';
import initSqlJs, { Database } from 'sql.js';
import fs from 'fs';
import path from 'path';

export const SQLITE_DB = Symbol('SQLITE_DB');
export type SqliteDb = Database;

function ensureDir(filePath: string): void {
  const dir = path.dirname(filePath);
  if (!fs.existsSync(dir)) {
    fs.mkdirSync(dir, { recursive: true });
  }
}

function initSchema(db: Database): void {
  db.run(`
    CREATE TABLE IF NOT EXISTS users (
      id TEXT PRIMARY KEY,
      username TEXT NOT NULL UNIQUE,
      password_hash TEXT NOT NULL,
      password_salt TEXT NOT NULL,
      permanent_code TEXT NOT NULL UNIQUE,
      shop_name TEXT,
      created_at INTEGER NOT NULL
    );

    CREATE UNIQUE INDEX IF NOT EXISTS users_username_key ON users(username);
    CREATE UNIQUE INDEX IF NOT EXISTS users_permanent_code_key ON users(permanent_code);

    CREATE TABLE IF NOT EXISTS qr_sessions (
      id TEXT PRIMARY KEY,
      user_id TEXT,                              -- 关联用户（永久码场景），NULL 表示临时会话
      code TEXT NOT NULL UNIQUE,
      status TEXT NOT NULL DEFAULT 'waiting',
      desktop_token TEXT NOT NULL,
      mobile_token TEXT,
      expires_at INTEGER NOT NULL,
      total_photos INTEGER NOT NULL DEFAULT 0,
      received_photos INTEGER NOT NULL DEFAULT 0,
      _created_at INTEGER NOT NULL,
      _updated_at INTEGER NOT NULL,
      FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE SET NULL
    );

    CREATE UNIQUE INDEX IF NOT EXISTS qr_sessions_code_key ON qr_sessions(code);
    CREATE INDEX IF NOT EXISTS idx_qr_sessions_code ON qr_sessions(code);
    CREATE INDEX IF NOT EXISTS idx_qr_sessions_user_id ON qr_sessions(user_id);
    CREATE INDEX IF NOT EXISTS idx_qr_sessions_expires_at ON qr_sessions(expires_at);

    CREATE TABLE IF NOT EXISTS qr_photos (
      id TEXT PRIMARY KEY,
      session_id TEXT NOT NULL,
      file_name TEXT NOT NULL,
      file_size INTEGER NOT NULL DEFAULT 0,
      download_url TEXT NOT NULL,
      file_path TEXT,
      bucket_id TEXT,
      status TEXT NOT NULL DEFAULT 'uploading',
      sort_order INTEGER NOT NULL DEFAULT 0,
      _created_at INTEGER NOT NULL,
      _updated_at INTEGER NOT NULL,
      FOREIGN KEY (session_id) REFERENCES qr_sessions(id) ON DELETE CASCADE
    );

    CREATE INDEX IF NOT EXISTS idx_qr_photos_session_id ON qr_photos(session_id);

    CREATE TABLE IF NOT EXISTS qr_signals (
      id TEXT PRIMARY KEY,
      session_code TEXT NOT NULL,
      role TEXT NOT NULL,         -- 'desktop' | 'mobile'
      type TEXT NOT NULL,         -- 'offer' | 'answer' | 'ice'
      payload TEXT NOT NULL,
      created_at INTEGER NOT NULL
    );
    CREATE INDEX IF NOT EXISTS idx_qr_signals_session_code ON qr_signals(session_code);

    CREATE TABLE IF NOT EXISTS shortcut_backups (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      shortcut_id TEXT NOT NULL UNIQUE,
      session_code TEXT NOT NULL,
      mobile_token TEXT NOT NULL,
      status TEXT NOT NULL DEFAULT 'running',
      _created_at INTEGER NOT NULL,
      _updated_at INTEGER
    );
    CREATE UNIQUE INDEX IF NOT EXISTS idx_shortcut_backups_id ON shortcut_backups(shortcut_id);
  `);
}

const databaseProvider: Provider = {
  provide: SQLITE_DB,
  useFactory: async (): Promise<Database> => {
    const SQL = await initSqlJs();
    const dbPath = process.env.SQLITE_DB_PATH || path.join(process.cwd(), 'data', 'app.db');
    ensureDir(dbPath);

    // 尝试加载已有数据库
    let db: Database;
    if (fs.existsSync(dbPath)) {
      const data = fs.readFileSync(dbPath);
      db = new SQL.Database(data);
    } else {
      db = new SQL.Database();
    }

    initSchema(db);
    return db;
  },
};

@Global()
@Module({
  providers: [databaseProvider],
  exports: [databaseProvider],
})
export class DatabaseModule {}

// 保存到磁盘的 helper（定期/关键时机调用）
export function saveDb(db: Database): void {
  const dbPath = process.env.SQLITE_DB_PATH || path.join(process.cwd(), 'data', 'app.db');
  const data = db.export();
  fs.writeFileSync(dbPath, Buffer.from(data));
}
