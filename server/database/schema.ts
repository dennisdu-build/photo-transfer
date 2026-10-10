/* eslint-disable */
/** SQLite schema for drizzle-orm */
import { sql } from 'drizzle-orm';
import { sqliteTable, text, integer, index, foreignKey, uniqueIndex } from 'drizzle-orm/sqlite-core';

export const qrSessions = sqliteTable("qr_sessions", {
  id: text("id").primaryKey(),
  code: text("code").notNull().unique(),
  status: text("status").notNull().default('waiting'),
  desktopToken: text("desktop_token").notNull(),
  mobileToken: text("mobile_token"),
  expiresAt: integer("expires_at", { mode: 'timestamp' }).notNull(),
  totalPhotos: integer("total_photos").notNull().default(0),
  receivedPhotos: integer("received_photos").notNull().default(0),
  createdAt: integer("_created_at", { mode: 'timestamp' }).notNull().$defaultFn(() => new Date()),
  updatedAt: integer("_updated_at", { mode: 'timestamp' }).notNull().$defaultFn(() => new Date()),
}, (table) => [
  uniqueIndex("qr_sessions_code_key").on(table.code),
  index("idx_qr_sessions_code").on(table.code),
  index("idx_qr_sessions_expires_at").on(table.expiresAt),
]);

export const qrPhotos = sqliteTable("qr_photos", {
  id: text("id").primaryKey(),
  sessionId: text("session_id").notNull(),
  fileName: text("file_name").notNull(),
  fileSize: integer("file_size").notNull().default(0),
  downloadUrl: text("download_url").notNull(),
  filePath: text("file_path"),
  bucketId: text("bucket_id"),
  status: text("status").notNull().default('uploading'),
  sortOrder: integer("sort_order").notNull().default(0),
  createdAt: integer("_created_at", { mode: 'timestamp' }).notNull().$defaultFn(() => new Date()),
  updatedAt: integer("_updated_at", { mode: 'timestamp' }).notNull().$defaultFn(() => new Date()),
}, (table) => [
  index("idx_qr_photos_session_id").on(table.sessionId),
  foreignKey({
    columns: [table.sessionId],
    foreignColumns: [qrSessions.id],
    name: "qr_photos_session_id_fkey",
  }).onDelete("cascade"),
]);

// table aliases
export const qrPhotosTable = qrPhotos;
export const qrSessionsTable = qrSessions;
