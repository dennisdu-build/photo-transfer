import { ref, computed, watch } from 'vue';
import QRCode from 'qrcode';
import { fetchBlob, smartSaveFile, supportsDirectoryPicker, beginAwaitPick, resolveAwaitPick, needsPickFolder } from '@client/src/pages/HomePage/file-saver';
import { useWebRtcReceiver, type P2PFileReceived } from './use-webrtc-receiver';
import { saveDirHandle, loadDirHandle } from '@client/src/pages/HomePage/fs-prefs';
import { useSessionStore } from '@client/src/stores/session';

const logger = {
  log: (...args: unknown[]) => console.log('[QR]', ...args),
  error: (...args: unknown[]) => console.error('[QR]', ...args),
  warn: (...args: unknown[]) => console.warn('[QR]', ...args),
};

export function useQrSession() {
  const store = useSessionStore();

  // ========== PC 端状态 ==========
  const qrDataUrl = ref('');
  const folderReady = ref(false);
  const rootFolderName = ref('');
  const folderName = ref('');
  const receivedPhotoIds = ref<Set<string>>(new Set());
  const downloadingPhotoIds = ref<Set<string>>(new Set());
  const p2pReceivedCount = ref(0);
  const downloadProgress = new Map<string, number>();
  const { p2pStatus, p2pProgress, startP2P, stopP2P, onFileComplete } = useWebRtcReceiver();

  let dirHandle: FileSystemDirectoryHandle | null = null;
  let activeDirHandle: FileSystemDirectoryHandle | null = null;
  let downloadQueue: string[] = [];
  let isDownloading = false;
  let hasTriggeredComplete = false;
  // Bridge: P2P 已收到的 fileName → poll 拉到 photo 后自动 ack
  const p2pReceivedFileNames = new Set<string>();

  // ========== 文件夹工具 ==========
  const createSessionSubfolder = async (rootHandle: FileSystemDirectoryHandle) => {
    try {
      const now = new Date();
      const pad = (n: number) => String(n).padStart(2, '0');
      const name = `照片快传-${now.getFullYear()}${pad(now.getMonth() + 1)}${pad(now.getDate())}-${pad(now.getHours())}${pad(now.getMinutes())}${pad(now.getSeconds())}`;
      const handle = await rootHandle.getDirectoryHandle(name, { create: true });
      logger.log('创建子文件夹:', name);
      return { handle, name };
    } catch (err) { logger.error('创建子文件夹失败', err); return null; }
  };

  const pickFolder = async () => {
    if (!supportsDirectoryPicker()) {
      folderReady.value = true;
      if (!store.code) await createSession();
      resolveAwaitPick(null);
      return;
    }
    try {
      const handle = await window.showDirectoryPicker({ mode: 'readwrite' });
      try { await (handle as any).requestPermission?.({ mode: 'readwrite' }); } catch {}
      dirHandle = handle;
      rootFolderName.value = handle.name;
      const sub = await createSessionSubfolder(handle);
      activeDirHandle = sub?.handle || handle;
      folderName.value = sub?.name || handle.name;
      folderReady.value = true;
      void saveDirHandle(handle);
      resolveAwaitPick(activeDirHandle);
      if (!store.code) await createSession();
      else if (p2pStatus.value === 'idle') startP2P(store.code, store.desktopToken, activeDirHandle, dirHandle);
    } catch {
      resolveAwaitPick(null);
    }
  };

  // ========== 下载队列（仅 relayEnabled 登录用户兜底） ==========
  const processDownloadQueue = async () => {
    if (isDownloading) return;
    isDownloading = true;
    const runOne = async (photoId: string) => {
      const photo = store.photos.find((p) => p.id === photoId);
      if (!photo) return;
      try {
        logger.log('[DownloadQueue] ▶', photo.fileName);
        downloadProgress.set(photoId, 1);
        const blob = await fetchBlob(photo.downloadUrl, (loaded, total) => {
          if (total > 0) downloadProgress.set(photoId, Math.min(99, Math.round((loaded / total) * 100)));
        });
        downloadProgress.set(photoId, 100);
        const target = activeDirHandle || dirHandle;
        const result = await smartSaveFile(target, photo.fileName, blob);
        logger.log('[DownloadQueue] ✅ saved:', result.savedName);
        await store.desktopAck([photo.id]);
        const s = new Set(receivedPhotoIds.value); s.add(photo.id); receivedPhotoIds.value = s;
        maybeComplete();
      } catch (err) {
        logger.error('[DownloadQueue] ❌', photo.fileName, err);
      } finally {
        downloadProgress.delete(photoId);
        const s = new Set(downloadingPhotoIds.value); s.delete(photoId); downloadingPhotoIds.value = s;
      }
    };

    while (downloadQueue.length > 0) {
      const chunk: string[] = [];
      for (let i = 0; i < 3 && downloadQueue.length > 0; i++) chunk.push(downloadQueue.shift()!);
      await Promise.all(chunk.map(runOne));
    }
    isDownloading = false;
    maybeComplete();
  };

  // ========== P2P 启动包装 ==========
  const startP2PSafe = (code: string, token: string) => {
    if (!supportsDirectoryPicker()) { startP2P(code, token, activeDirHandle, dirHandle); return; }
    if (!activeDirHandle && !dirHandle) {
      logger.log('📥 P2P 启动但没文件夹 → 启动等待 + 弹覆盖层');
      void beginAwaitPick();
    }
    startP2P(code, token, activeDirHandle, dirHandle);
  };

  // ========== 后端同步回调 ==========
  const onBackendSync = () => {
    const s = store.session;
    if (!s) return;
    const photosArr = store.photos;
    const relayEnabled = s.relayEnabled === true;

    logger.log(`[Sync] relay=${relayEnabled ? 'ON' : 'OFF'}, photos=${photosArr.length}, p2pFileNames=${p2pReceivedFileNames.size}, queue=${downloadQueue.length}`);

    // Bridge: P2P 已收到的 fileName → 匹配后端 ready photo → 自动 ack
    const bridgeMatches = photosArr.filter((p) =>
      p.status === 'ready' && !receivedPhotoIds.value.has(p.id) && p2pReceivedFileNames.has(p.fileName),
    );
    if (bridgeMatches.length > 0) {
      logger.log(`[Bridge] 🎯 ${bridgeMatches.length} 张 P2P 已收到 → ack`);
      const ids = bridgeMatches.map((p) => p.id);
      const s2 = new Set(receivedPhotoIds.value);
      ids.forEach((id) => s2.add(id));
      receivedPhotoIds.value = s2;
      void store.desktopAck(ids);
      maybeComplete();
    }

    // 服务器中转兜底（任何场景都启，不限 relayEnabled）
    // 手机端 sendAllP2P 里 uploadFileToServer 已传了文件 → 后端有 downloadUrl
    // P2P 断了后靠这个兜底
    const newReady = photosArr
      .filter((p) => p.status === 'ready' && !receivedPhotoIds.value.has(p.id) && !downloadingPhotoIds.value.has(p.id)
        && !downloadQueue.includes(p.id) && !p2pReceivedFileNames.has(p.fileName))
      .map((p) => p.id);
    if (newReady.length > 0) {
      logger.log(`[Relay] ${newReady.length} 张 → downloadQueue (relay=${relayEnabled ? 'ON' : 'OFF'})`);
      const s2 = new Set(downloadingPhotoIds.value);
      newReady.forEach((id) => s2.add(id));
      downloadingPhotoIds.value = s2;
      newReady.forEach((id) => downloadQueue.push(id));
      if (!isDownloading) void processDownloadQueue();
    }

    // session.status 驱动 P2P 启动 + 完成
    if ((s.status === 'connected' || s.status === 'transferring') && p2pStatus.value === 'idle') {
      try { logger.log('[P2P] 🚀 启动 receiver'); startP2PSafe(store.code, store.desktopToken); } catch (e) { logger.error('startP2P', e); }
    }
    if (s.status === 'completed') {
      logger.log('[Backend] ✅ completed');
      void processDownloadQueue();
      maybeComplete();
    }
  };

  // ========== 完成检测 ==========
  let autoRestartTimer: ReturnType<typeof setTimeout> | null = null;
  const maybeComplete = () => {
    if (hasTriggeredComplete) return;
    const done = Math.max(p2pReceivedCount.value, receivedPhotoIds.value.size);
    if (store.totalPhotos > 0 && done >= store.totalPhotos) {
      hasTriggeredComplete = true;
      logger.log(`✅ 全部完成！P2P ${p2pReceivedCount.value}, Ack ${receivedPhotoIds.value.size} / ${store.totalPhotos}`);
      store.desktopComplete();
      // 10 秒后自动清空重启（用户如果手动 restart 会清这个 timer）
      autoRestartTimer = setTimeout(() => { logger.log('⏰ 10s 到 → 自动重启'); void restart(); }, 10000);
    }
  };

  // ========== 会话操作 ==========
  const createSession = async () => {
    try {
      const data = await store.createSession();
      qrDataUrl.value = await QRCode.toDataURL(data.mobileUrl, { width: 560, margin: 0, color: { dark: '#000000', light: '#ffffff' } });
      store.startPolling('desktop');
    } catch (err) { logger.error('创建会话失败', err); }
  };

  const restart = async () => {
    if (autoRestartTimer) { clearTimeout(autoRestartTimer); autoRestartTimer = null; }
    stopP2P();
    store.reset();
    if (dirHandle) {
      rootFolderName.value = dirHandle.name;
      const sub = await createSessionSubfolder(dirHandle);
      activeDirHandle = sub?.handle || dirHandle;
      folderName.value = sub?.name || dirHandle.name;
    }
    downloadQueue = []; isDownloading = false; hasTriggeredComplete = false;
    p2pReceivedCount.value = 0;
    p2pReceivedFileNames.clear();
    downloadProgress.clear();
    p2pProgress.clear();
    qrDataUrl.value = '';
    receivedPhotoIds.value = new Set();
    downloadingPhotoIds.value = new Set();
    resolveAwaitPick(null);
    await createSession();
  };

  // openSavedFolder 已移除：UI 上直接显示文件夹名，浏览器沙箱不允许 web app 打开系统文件管理器

  // ========== P2P 回调 ==========
  onFileComplete((file: P2PFileReceived) => {
    p2pReceivedCount.value++;
    p2pReceivedFileNames.add(file.fileName);
    logger.log(`P2P #${p2pReceivedCount.value} ${file.fileName}`);
    // Bridge 会在下次 poll 时自动匹配 ack，这里不重复调
    maybeComplete();
  });

  // ========== watch + 初始化 ==========
  watch(() => store.session, () => onBackendSync());

  // 初始化：恢复文件夹 → 自动创建会话
  loadDirHandle().then(async (handle) => {
    if (handle) {
      dirHandle = handle;
      rootFolderName.value = handle.name;
      try {
        const sub = await createSessionSubfolder(handle);
        activeDirHandle = sub?.handle || handle;
        folderName.value = sub?.name || handle.name;
      } catch { activeDirHandle = handle; folderName.value = handle.name; }
      folderReady.value = true;
    } else {
      folderReady.value = true;
      folderName.value = 'Downloads 文件夹';
    }
    await createSession();
  }).catch(async () => { folderReady.value = true; folderName.value = 'Downloads'; await createSession(); });

  // ========== 暴露 ==========
  return {
    // computed
    status: computed(() => store.pageStatus),
    errorMessage: computed(() => store.errorMessage),
    sessionCode: computed(() => store.code),
    session: computed(() => store.session),
    photos: computed(() => store.photos),
    qrDataUrl, folderReady, rootFolderName, folderName,
    hasFolderHandle: computed(() => !!dirHandle),
    needsPickFolder,
    p2pStatus, p2pReceivedCount,
    receivedPhotoIds, downloadingPhotoIds, downloadProgress, p2pProgress,
    // store（直接暴露给页面）
    store,
    // actions
    pickFolder, restart, createSession,
  };
}
