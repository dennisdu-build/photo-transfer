import { ref, onUnmounted } from 'vue';
import { qrTransfer } from '@client/src/api';
import { requestWakeLock, releaseAllWakeLocks } from '@client/src/utils/wake-lock';

const logger = {
  log: (...args: unknown[]) => console.log('[WebRTC-Mobile]', ...args),
  error: (...args: unknown[]) => console.error('[WebRTC-Mobile]', ...args),
  warn: (...args: unknown[]) => console.warn('[WebRTC-Mobile]', ...args),
};

const CHUNK_SIZE = 16384;
const SIGNAL_POLL_INTERVAL = 1500;

export type MobileP2PStatus = 'idle' | 'connecting' | 'connected' | 'failed';

export function useWebRtcSender() {
  const p2pStatus = ref<MobileP2PStatus>('idle');
  const pc = ref<RTCPeerConnection | null>(null);
  const dc = ref<RTCDataChannel | null>(null);
  const signalPollTimer = ref<ReturnType<typeof setTimeout> | null>(null);
  let remoteSet = false;
  let lastOfferSdp = '';
  let iceCandidatesToAdd: string[] = [];
  let wakeLockRelease = () => {};

  const isP2PAvailable = (): boolean => {
    return typeof RTCPeerConnection !== 'undefined' && typeof RTCSessionDescription !== 'undefined';
  };

  const stopP2P = () => {
    wakeLockRelease();
    releaseAllWakeLocks();
    if (signalPollTimer.value) { clearTimeout(signalPollTimer.value); signalPollTimer.value = null; }
    if (dc.value) { try { dc.value.close(); } catch { /* noop */ } dc.value = null; }
    if (pc.value) { try { pc.value.close(); } catch { /* noop */ } pc.value = null; }
    remoteSet = false;
  };

  const connectP2P = async (code: string, token: string): Promise<boolean> => {
    if (!code || !token) return false;
    if (!isP2PAvailable()) { p2pStatus.value = 'failed'; return false; }

    p2pStatus.value = 'connecting';
    logger.log('手机端开始 P2P 连接...');

    const makePc = () => {
      const newPc = new RTCPeerConnection({
        iceServers: [
          { urls: 'stun:stun.l.google.com:19302' },
          { urls: 'stun:stun1.l.google.com:19302' },
        ],
      });
      pc.value = newPc;
      return newPc;
    };

    const attachEvents = (curPc: RTCPeerConnection) => {
      curPc.onicecandidate = async (ev) => {
        if (!ev.candidate) return;
        try {
          await qrTransfer.sendSignal({
            code, token, role: 'mobile',
            message: { type: 'ice', role: 'mobile', payload: JSON.stringify(ev.candidate) },
          });
        } catch (err) { logger.warn('发送 ICE 失败', err); }
      };

      curPc.onconnectionstatechange = () => {
        const s = curPc.connectionState;
        logger.log('手机端 PeerConnection state:', s);
        if (s === 'disconnected') {
          logger.warn('手机端 PC disconnected，等待电脑端重建 offer...');
          p2pStatus.value = 'connecting';
          remoteSet = false;
        } else if (s === 'failed' || s === 'closed') {
          logger.warn('手机端 PC 彻底失败');
          p2pStatus.value = 'failed';
        }
      };

      curPc.ondatachannel = (ev) => {
        logger.log('收到 DataChannel!' + (dc.value ? '（重连）' : ''));
        bindDataChannel(ev.channel);
      };
    };

    const bindDataChannel = (channel: RTCDataChannel) => {
      dc.value = channel;
      channel.onopen = () => {
        logger.log('DataChannel 打开！P2P 连接成功 🎉');
        p2pStatus.value = 'connected';
        void requestWakeLock().then((fn) => { wakeLockRelease = fn; });
      };
      channel.onclose = () => {
        logger.log('DataChannel 关闭，pc.state=', pc.value?.connectionState);
        wakeLockRelease();
        const s = pc.value?.connectionState;
        if (s === 'connected' || s === 'connecting' || s === 'disconnected') {
          p2pStatus.value = 'connecting';
          setTimeout(() => {
            if (p2pStatus.value === 'connecting' && dc.value?.readyState !== 'open') {
              logger.warn('8 秒内未收到新 DataChannel，P2P 放弃');
              p2pStatus.value = 'failed';
            }
          }, 8000);
        } else {
          p2pStatus.value = 'failed';
        }
      };
      channel.onerror = (e) => logger.error('DataChannel 错误', e);
    };

    const handleOffer = async (offerSdp: RTCSessionDescriptionInit) => {
      const sdpStr = offerSdp.sdp || '';
      if (lastOfferSdp && lastOfferSdp !== sdpStr) {
        logger.log('🔄 检测到重建 offer（SDP 不同），手机端重建 PC');
        try { if (pc.value) pc.value.close(); } catch { /* noop */ }
        const newPc = makePc();
        attachEvents(newPc);
        dc.value = null;
      }
      lastOfferSdp = sdpStr;
      const curPc = pc.value!;
      await curPc.setRemoteDescription(new RTCSessionDescription(offerSdp));
      remoteSet = true;
      for (const ice of iceCandidatesToAdd) {
        try { await curPc.addIceCandidate(new RTCIceCandidate(JSON.parse(ice))); } catch { /* noop */ }
      }
      iceCandidatesToAdd = [];
      const answer = await curPc.createAnswer();
      await curPc.setLocalDescription(answer);
      await qrTransfer.sendSignal({
        code, token, role: 'mobile',
        message: { type: 'answer', role: 'mobile', payload: JSON.stringify(answer) },
      });
      logger.log('已发送 answer 给电脑端');
    };

    const initialPc = makePc();
    attachEvents(initialPc);

    try {
      const initialRes = await qrTransfer.pollSignals(code, token, 'mobile');
      for (const m of initialRes.messages) {
        if (m.type === 'offer') {
          logger.log('收到电脑端 offer');
          await handleOffer(JSON.parse(m.payload));
        } else if (m.type === 'ice') {
          if (remoteSet) {
            try { await pc.value!.addIceCandidate(new RTCIceCandidate(JSON.parse(m.payload))); } catch { /* noop */ }
          } else {
            iceCandidatesToAdd.push(m.payload);
          }
        }
      }
    } catch (err) {
      logger.error('处理 offer 失败', err);
      p2pStatus.value = 'failed';
      return false;
    }

    const pollOnce = async () => {
      if (!pc.value || p2pStatus.value === 'connected') return;
      try {
        const res = await qrTransfer.pollSignals(code, token, 'mobile');
        for (const m of res.messages) {
          if (m.type === 'offer') {
            const sdp = JSON.parse(m.payload) as RTCSessionDescriptionInit;
            const sdpStr = sdp.sdp || '';
            const isNewOffer = !remoteSet || sdpStr !== lastOfferSdp;
            if (isNewOffer) {
              logger.log('poll 收到新 offer');
              await handleOffer(sdp);
            }
          } else if (m.type === 'ice') {
            if (remoteSet) {
              try { await pc.value!.addIceCandidate(new RTCIceCandidate(JSON.parse(m.payload))); } catch { /* noop */ }
            } else {
              iceCandidatesToAdd.push(m.payload);
            }
          }
        }
      } catch (err) { logger.warn('轮询信令失败', err); }
      signalPollTimer.value = setTimeout(pollOnce, SIGNAL_POLL_INTERVAL);
    };
    pollOnce();

    await new Promise<void>((resolve) => {
      const check = () => { if (p2pStatus.value === 'connected') resolve(); else setTimeout(check, 500); };
      const to = setTimeout(() => resolve(), 10000);
      check();
      setTimeout(() => { clearTimeout(to); resolve(); }, 10500);
    });

    if (p2pStatus.value !== 'connected') { p2pStatus.value = 'failed'; return false; }
    return true;
  };

  const sendFiles = async (files: File[], onProgress?: (done: number, total: number) => void): Promise<{ sent: number; p2pBroken: boolean }> => {
    if (!dc.value || p2pStatus.value !== 'connected') {
      logger.warn('P2P 未就绪');
      return { sent: 0, p2pBroken: true };
    }
    let sent = 0;

    const drainBuffer = async (dc: RTCDataChannel): Promise<boolean> => {
      const MAX_BUFFER = 98304;
      let waited = 0;
      const MAX_WAIT = 30000;
      while (dc.bufferedAmount > MAX_BUFFER) {
        await new Promise((r) => setTimeout(r, 15));
        waited += 15;
        if (waited > MAX_WAIT) return false;
      }
      return true;
    };

    for (const file of files) {
      if (!dc.value || dc.value.readyState !== 'open') {
        logger.warn('DataChannel 已断开');
        return { sent, p2pBroken: true };
      }
      const curDc = dc.value;
      const fileId = `${Date.now()}-${Math.random().toString(36).slice(2, 8)}`;
      logger.log('发送文件:', file.name, file.size, 'bytes');

      curDc.send(JSON.stringify({ type: 'file-start', id: fileId, fileName: file.name, fileSize: file.size }));

      const buffer = await file.arrayBuffer();
      let offset = 0;
      let chunkCount = 0;
      while (offset < buffer.byteLength) {
        if (curDc.readyState !== 'open') return { sent, p2pBroken: true };
        const end = Math.min(offset + CHUNK_SIZE, buffer.byteLength);
        const slice = buffer.slice(offset, end);
        curDc.send(JSON.stringify({ type: 'file-chunk', id: fileId, offset }));
        curDc.send(slice);
        offset = end;
        chunkCount++;
        if (chunkCount % 8 === 0) {
          const ok = await drainBuffer(curDc);
          if (!ok) return { sent, p2pBroken: true };
        }
      }
      if (curDc.readyState !== 'open') return { sent, p2pBroken: true };
      const ok = await drainBuffer(curDc);
      if (!ok) return { sent, p2pBroken: true };
      curDc.send(JSON.stringify({ type: 'file-end', id: fileId }));
      sent++;
      onProgress?.(sent, files.length);
    }

    logger.log(`P2P 发送完成: ${sent}/${files.length}`);
    return { sent, p2pBroken: false };
  };

  onUnmounted(() => stopP2P());

  return { p2pStatus, isP2PAvailable, connectP2P, sendFiles, stopP2P };
}
