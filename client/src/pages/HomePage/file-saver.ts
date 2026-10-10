import { ref } from 'vue';

const logger = {
  log: (...args: unknown[]) => console.log('[FileSaver]', ...args),
  error: (...args: unknown[]) => console.error('[FileSaver]', ...args),
  warn: (...args: unknown[]) => console.warn('[FileSaver]', ...args),
};

/**
 * 判断浏览器是否支持 File System Access API 的 showDirectoryPicker
 */
export function supportsDirectoryPicker(): boolean {
  return typeof window !== 'undefined' && 'showDirectoryPicker' in window;
}

/**
 * 从文件名中拆分出 name 和 ext，用于重名加序号
 */
function splitNameExt(fileName: string): { name: string; ext: string } {
  const lastDot = fileName.lastIndexOf('.');
  if (lastDot <= 0) return { name: fileName, ext: '' };
  return {
    name: fileName.slice(0, lastDot),
    ext: fileName.slice(lastDot),
  };
}

/**
 * 在指定目录下生成一个不重名的文件名
 */
async function resolveUniqueFileName(
  dirHandle: FileSystemDirectoryHandle,
  fileName: string,
): Promise<string> {
  const { name, ext } = splitNameExt(fileName);
  let candidate = fileName;
  let index = 1;
  // eslint-disable-next-line no-constant-condition
  while (true) {
    try {
      await dirHandle.getFileHandle(candidate, { create: false });
      candidate = `${name}(${index})${ext}`;
      index += 1;
    } catch {
      return candidate;
    }
  }
}

/**
 * 通过 File System Access API 将 blob 写入选定的文件夹（会抛异常，由调用方 try-catch）
 */
export async function saveToDirectory(
  dirHandle: FileSystemDirectoryHandle,
  fileName: string,
  blob: Blob,
): Promise<void> {
  const uniqueName = await resolveUniqueFileName(dirHandle, fileName);
  const fileHandle = await dirHandle.getFileHandle(uniqueName, { create: true });
  const writable = await fileHandle.createWritable();
  try {
    await writable.write(blob);
  } finally {
    await writable.close();
  }
}

/**
 * 从 Blob 直接触发浏览器原生下载（自动下载到下载文件夹）
 */
export function triggerBlobDownload(fileName: string, blob: Blob): void {
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = url;
  a.download = fileName;
  a.rel = 'noopener noreferrer';
  document.body.appendChild(a);
  a.click();
  setTimeout(() => {
    document.body.removeChild(a);
    URL.revokeObjectURL(url);
  }, 2000);
}

/**
 * 从下载地址 fetch blob，支持进度回调
 */
export async function fetchBlob(
  url: string,
  onProgress?: (loaded: number, total: number) => void,
): Promise<Blob> {
  const res = await fetch(url);
  if (!res.ok) {
    throw new Error(`下载失败：${res.status} ${res.statusText}`);
  }
  if (!onProgress || !res.body) {
    return res.blob();
  }
  const total = Number(res.headers.get('content-length') || 0);
  const reader = res.body.getReader();
  const chunks: Uint8Array[] = [];
  let loaded = 0;
  while (true) {
    const { done, value } = await reader.read();
    if (done) break;
    chunks.push(value);
    loaded += value.byteLength;
    if (total > 0) onProgress(loaded, total);
  }
  if (total > 0) onProgress(loaded, loaded);
  return new Blob(chunks, { type: res.headers.get('content-type') || 'application/octet-stream' });
}

// ========== 🔑 等待用户选文件夹机制（全局状态） ==========
// showDirectoryPicker 必须在用户手势里调，但 P2P/下载是异步回调
// 所以：当 dirHandle 为 null 且正在等待用户选时 → smartSaveFile await 等选完
let pendingHandlePromise: Promise<FileSystemDirectoryHandle | null> | null = null;
let pendingHandleResolve: ((h: FileSystemDirectoryHandle | null) => void) | null = null;

/**
 * UI 应该显示"选择保存位置"覆盖层吗？
 * 这是全局单一状态源，composable 和 HomePage 都从这里读
 */
export const needsPickFolder = ref(false);

/**
 * 告诉 smartSaveFile：开始等待用户选文件夹
 * 之后所有 dir=null 的 smartSaveFile 会 await 这个 promise
 */
export function beginAwaitPick(): Promise<FileSystemDirectoryHandle | null> {
  if (pendingHandlePromise) return pendingHandlePromise;
  pendingHandlePromise = new Promise((resolve) => {
    pendingHandleResolve = resolve;
  });
  needsPickFolder.value = true;
  return pendingHandlePromise;
}

/**
 * 用户选完文件夹（或取消）后调这个，解除等待
 */
export function resolveAwaitPick(handle: FileSystemDirectoryHandle | null) {
  if (pendingHandleResolve) {
    pendingHandleResolve(handle);
    pendingHandleResolve = null;
    pendingHandlePromise = null;
  }
  needsPickFolder.value = false;
}

/**
 * 统一保存入口（所有场景都调这个）
 * - 有 dirHandle → File System Access API 写文件夹
 * - 失败（权限/异步受限）→ 浏览器原生下载
 * - 无 dirHandle 但在等待用户选 → await 等选完再写
 */
export async function smartSaveFile(
  dirHandle: FileSystemDirectoryHandle | null,
  fileName: string,
  blob: Blob,
): Promise<{ mode: 'fs' | 'download'; ok: boolean; savedName: string }> {
  let handle = dirHandle;

  // dirHandle 为空 → 检查有没有在等待用户选文件夹
  if (!handle && pendingHandlePromise) {
    logger.log('smartSaveFile: 等待用户选文件夹...', fileName);
    handle = await pendingHandlePromise;
  }

  if (!handle) {
    logger.warn('smartSaveFile: 无文件夹 → 浏览器下载', fileName);
    triggerBlobDownload(fileName, blob);
    return { mode: 'download', ok: true, savedName: fileName };
  }

  try {
    await saveToDirectory(handle, fileName, blob);
    return { mode: 'fs', ok: true, savedName: fileName };
  } catch (err) {
    logger.warn('File System 写入失败 → 降级浏览器下载:', err);
  }

  triggerBlobDownload(fileName, blob);
  return { mode: 'download', ok: true, savedName: fileName };
}
