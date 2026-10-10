import { ref, reactive, onUnmounted } from 'vue';
import { qrTransfer } from '@client/src/api';
import { requestWakeLock, releaseAllWakeLocks } from '@client/src/utils/wake-lock';
import { smartSaveFile } from '@client/src/pages/HomePage/file-saver';

const logger = {
  log: (...args: unknown[]) => console.log('[WebRTC]', ...args),
  error: (...args: unknown[]) => console.error('[WebRTC]', ...args),
  warn: (...args: unknown[]) => console.warn('[WebRTC]', ...args),
};

const CHUNK_SIZE = 16384;
const P2P_CONNECT_TIMEOUT = 5000;

export type P2PStatus = 'idle' | 'connecting' | 'connected' | 'failed';

export interface P2PFileMeta {
  id: string;
  fileName: string;
  fileSize: number;
  chunks: ArrayBuffer[];
}

export interface P2PFileReceived extends P2PFileMeta {
  blob: Blob;
}

export function useWebRtcReceiver() {
  const p2pStatus = ref<P2PStatus>('idle');
  const p2pFilesMap = new Map<string, P2PFileMeta>();
  // 响应式：fileName → 进度 0~100
  const p2pProgress = reactive(new Map<string, number>());
  const pc = ref<RTCPeerConnection | null>(null);
  const dc = ref<RTCDataChannel | null>(null);
  const signalPollTimer = ref<ReturnType<typeof setTimeout> | null>(null);
  const connectTimeoutTimer = ref<ReturnType<typeof setTimeout> | null>(null);
  const disconnectTimer = ref<ReturnType<typeof setTimeout> | null>(null);
  const fileCompleteCbs: Array<(f: P2PFileReceived) => void> = [];
  const msgQueue: Array<{ kind: 'json' | 'binary'; data: any }> = [];
  let msgProcessing = false;
  let chunkIdForNextBinary = '';
  let wakeLockRelease: () => void = () => {};
  let dcReconnectAttempts = 0;
  let fullReconnectCount = 0;
  const MAX_FULL_RECONNECT = 2;
  const MAX_DC_RECONNECT = 5;

  let boundAttachDc: ((ch: RTCDataChannel) => void) | null = null;
  let boundOnIceCandidate: ((ev: RTCPeerConnectionIceEvent) => Promise<void>) | null = null;
  let boundOnConnStateChange: (() => void) | null = null;
  let boundPollSignals: (() => Promise<void>) | null = null;

  const setStatus = (s: P2PStatus) => { p2pStatus.value = s; };

  const onFileComplete = (cb: (f: P2PFileReceived) => void) => {
    fileCompleteCbs.push(cb);
  };

  const processMsgQueue = async () => {
    if (msgProcessing) return;
    msgProcessing = true;
    while (msgQueue.length > 0) {
      const item = msgQueue.shift()!;
      try {
        if (item.kind === 'json') {
          const msg = JSON.parse(item.data);
          if (msg.type === 'file-chunk') {
            chunkIdForNextBinary = msg.id;
          } else if (msg.type === 'file-start') {
            logger.log('收到文件开始:', msg.fileName, msg.fileSize, 'bytes');
            p2pFilesMap.set(msg.id, {
              id: msg.id, fileName: msg.fileName, fileSize: msg.fileSize, chunks: [],
            });
            p2pProgress.set(msg.fileName, 1); // 起始 1% 让 UI 动起来
          } else if (msg.type === 'file-end') {
            const file = p2pFilesMap.get(msg.id);
            if (file) {
              const blob = new Blob(file.chunks, { type: 'application/octet-stream' });
              const finalFile: P2PFileReceived = { ...file, blob };
              logger.log('文件接收完成:', file.fileName, blob.size, 'bytes', '(chunks:', file.chunks.length, ')');
              p2pProgress.set(file.fileName, 100);
              // 保存时从外部传入 dirHandle
              const dir = dirHandleRef.value;
              const result = await smartSaveFile(dir, file.fileName, blob);
              logger.log(result.mode === 'fs' ? '已写入本地文件夹:' : '已触发浏览器下载:', result.savedName);
              fileCompleteCbs.forEach((cb) => { try { cb(finalFile); } catch { /* noop */ } });
              file.chunks = [];
            }
          }
        } else {
          const id = chunkIdForNextBinary;
          chunkIdForNextBinary = '';
          if (!id) continue;
          const file = p2pFilesMap.get(id);
          if (file) {
            const arrBuf = item.data instanceof Blob ? await item.data.arrayBuffer() : item.data;
            file.chunks.push(arrBuf);
            // 更新进度
            const received = file.chunks.length * CHUNK_SIZE;
            const pct = Math.min(99, Math.round((received / file.fileSize) * 100));
            p2pProgress.set(file.fileName, pct);
          }
        }
      } catch (err) { logger.error('队列处理出错', err); }
    }
    msgProcessing = false;
  };

  // 外部注入的 dirHandle（Vue 响应式 ref）
  const dirHandleRef = ref<FileSystemDirectoryHandle | null>(null);

  const startP2P = async (code: string, token: string, dirHandle: FileSystemDirectoryHandle | null, rootDirHandle?: FileSystemDirectoryHandle | null) => {
    if (!code || !token) { logger.warn('startP2P: code/token 空'); return; }
    dirHandleRef.value = dirHandle || rootDirHandle || null;

    // 清上一轮
    if (signalPollTimer.value) { clearTimeout(signalPollTimer.value); signalPollTimer.value = null; }
    if (disconnectTimer.value) { clearTimeout(disconnectTimer.value); disconnectTimer.value = null; }
    if (connectTimeoutTimer.value) { clearTimeout(connectTimeoutTimer.value); connectTimeoutTimer.value = null; }
    if (pc.value) { try { pc.value.close(); } catch { /* noop */ } pc.value = null; }
    if (dc.value) { try { dc.value.close(); } catch { /* noop */ } dc.value = null; }

    setStatus('connecting');
    logger.log('开始 P2P 连接...');

    const newPc = new RTCPeerConnection({
      iceServers: [
        { urls: 'stun:stun.l.google.com:19302' },
        { urls: 'stun:stun1.l.google.com:19302' },
      ],
    });
    pc.value = newPc;

    boundAttachDc = (channel: RTCDataChannel) => {
      dc.value = channel;
      channel.onopen = () => {
        if (pc.value !== newPc) return;
        logger.log('DataChannel 打开！P2P 连接成功 🎉');
        setStatus('connected');
        dcReconnectAttempts = 0;
        if (connectTimeoutTimer.value) { clearTimeout(connectTimeoutTimer.value); connectTimeoutTimer.value = null; }
        void requestWakeLock().then((fn) => { wakeLockRelease = fn; });
      };
      channel.onclose = () => {
        if (pc.value !== newPc) return;
        logger.log('DataChannel 关闭，pc.state=', newPc.connectionState);
        wakeLockRelease();
        const s = newPc.connectionState;
        if ((s === 'connected' || s === 'connecting' || s === 'disconnected') && dcReconnectAttempts < MAX_DC_RECONNECT) {
          dcReconnectAttempts++;
          const delay = 300;
          logger.log(`${delay}ms 后重建 DataChannel（第 ${dcReconnectAttempts}/${MAX_DC_RECONNECT} 次）...`);
          setStatus('connecting');
          setTimeout(() => {
            const curPc = pc.value;
            if (!curPc || curPc !== newPc) return;
            try {
              const newDc = curPc.createDataChannel('photo-transfer', { ordered: true });
              boundAttachDc!(newDc);
            } catch (err) {
              logger.error('重建 DC 失败', err);
              setStatus('failed');
            }
          }, delay);
        } else {
          setStatus('failed');
        }
      };
      channel.onerror = (e) => logger.error('DataChannel 错误', e);
      channel.onmessage = (ev) => {
        if (typeof ev.data === 'string') {
          msgQueue.push({ kind: 'json', data: ev.data });
        } else {
          msgQueue.push({ kind: 'binary', data: ev.data });
        }
        void processMsgQueue();
      };
    };

    boundAttachDc(newPc.createDataChannel('photo-transfer', { ordered: true }));

    boundOnIceCandidate = async (ev: RTCPeerConnectionIceEvent) => {
      if (!ev.candidate) return;
      try {
        await qrTransfer.sendSignal({
          code, token, role: 'desktop',
          message: { type: 'ice', role: 'desktop', payload: JSON.stringify(ev.candidate) },
        });
      } catch (err) { logger.warn('发送 ICE 失败', err); }
    };
    newPc.onicecandidate = boundOnIceCandidate;

    boundOnConnStateChange = () => {
      if (pc.value !== newPc) return;
      const s = newPc.connectionState;
      logger.log('PeerConnection state:', s);
      if (s === 'connected') {
        if (disconnectTimer.value) { clearTimeout(disconnectTimer.value); disconnectTimer.value = null; }
        fullReconnectCount = 0;
        setStatus('connected');
        return;
      }
      if (s === 'failed' || s === 'closed') {
        if (disconnectTimer.value) { clearTimeout(disconnectTimer.value); disconnectTimer.value = null; }
        setStatus('failed');
        return;
      }
      if (s === 'disconnected') {
        if (disconnectTimer.value) { clearTimeout(disconnectTimer.value); disconnectTimer.value = null; }
        try { if (newPc.restartIce) { logger.log('主动 restartIce()...'); newPc.restartIce(); } } catch {}
        setStatus('connecting');
        logger.warn('ICE 断开，给 10 秒观察期...');
        disconnectTimer.value = setTimeout(() => {
          const curPc = pc.value;
          if (curPc !== newPc) return;
          const st = curPc.connectionState;
          if (st === 'connected') { setStatus('connected'); return; }
          if (st === 'disconnected' && fullReconnectCount < MAX_FULL_RECONNECT) {
            fullReconnectCount++;
            logger.warn(`10 秒仍 disconnected → 完整重建 P2P（第 ${fullReconnectCount}/${MAX_FULL_RECONNECT} 次）`);
            if (dc.value) { try { dc.value.close(); } catch { /* noop */ } dc.value = null; }
            if (pc.value) { try { pc.value.close(); } catch { /* noop */ } pc.value = null; }
            disconnectTimer.value = null;
            dcReconnectAttempts = 0;
            void startP2P(code, token, dirHandleRef.value, rootDirHandle);
          } else {
            logger.warn(`无法恢复（状态: ${st}, 重建次数: ${fullReconnectCount}）→ P2P 彻底失败`);
            setStatus('failed');
            disconnectTimer.value = null;
          }
        }, 10000);
      }
    };
    newPc.onconnectionstatechange = boundOnConnStateChange;

    const offer = await newPc.createOffer();
    await newPc.setLocalDescription(offer);

    try {
      const res = await qrTransfer.sendSignal({
        code, token, role: 'desktop',
        message: { type: 'offer', role: 'desktop', payload: JSON.stringify(offer) },
      });
      if (pc.value !== newPc) { logger.log('offer 发送后 PC 已重建'); return; }
      for (const m of res.messages) {
        if (m.type === 'answer') {
          await newPc.setRemoteDescription(new RTCSessionDescription(JSON.parse(m.payload)));
        } else if (m.type === 'ice') {
          try { await newPc.addIceCandidate(new RTCIceCandidate(JSON.parse(m.payload))); } catch { /* noop */ }
        }
      }
    } catch (err) { logger.error('发送 offer 失败', err); setStatus('failed'); return; }

    boundPollSignals = async () => {
      const curPc = pc.value;
      if (!curPc || curPc !== newPc || curPc.signalingState === 'closed') { signalPollTimer.value = null; return; }
      try {
        const res = await qrTransfer.pollSignals(code, token, 'desktop');
        for (const m of res.messages) {
          const pcNow = pc.value;
          if (!pcNow || pcNow !== newPc || pcNow.signalingState === 'closed') { signalPollTimer.value = null; return; }
          if (m.type === 'ice') {
            try { await pcNow.addIceCandidate(new RTCIceCandidate(JSON.parse(m.payload))); } catch { /* noop */ }
          } else if (m.type === 'answer') {
            if (pcNow.signalingState !== 'stable') {
              await pcNow.setRemoteDescription(new RTCSessionDescription(JSON.parse(m.payload)));
            }
          }
        }
      } catch (err) { logger.warn('拉取信令失败', err); }
      if (pc.value && pc.value === newPc && pc.value.signalingState !== 'closed') {
        signalPollTimer.value = setTimeout(boundPollSignals!, 1500);
      } else {
        signalPollTimer.value = null;
      }
    };
    boundPollSignals();

    connectTimeoutTimer.value = setTimeout(() => {
      if (p2pStatus.value !== 'connected') {
        logger.warn(`P2P ${P2P_CONNECT_TIMEOUT}ms 内未连接 → 降级服务器中转`);
        setStatus('failed');
      }
    }, P2P_CONNECT_TIMEOUT);
  };

  const stopP2P = () => {
    wakeLockRelease();
    releaseAllWakeLocks();
    if (signalPollTimer.value) { clearTimeout(signalPollTimer.value); signalPollTimer.value = null; }
    if (connectTimeoutTimer.value) { clearTimeout(connectTimeoutTimer.value); connectTimeoutTimer.value = null; }
    if (disconnectTimer.value) { clearTimeout(disconnectTimer.value); disconnectTimer.value = null; }
    if (dc.value) { try { dc.value.close(); } catch { /* noop */ } dc.value = null; }
    if (pc.value) { try { pc.value.close(); } catch { /* noop */ } pc.value = null; }
    // 清空进度
    p2pProgress.clear();
    p2pFilesMap.clear();
  };

  onUnmounted(() => stopP2P());

  return { p2pStatus, p2pProgress, startP2P, stopP2P, onFileComplete };
}
