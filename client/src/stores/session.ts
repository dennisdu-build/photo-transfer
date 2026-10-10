import { defineStore } from 'pinia';
import { ref, computed } from 'vue';
import { qrTransfer, type MobileJoinResponse, type SessionStatusResponse } from '@client/src/api';
import type { QrPhotoInfo, QrSessionInfo } from '@shared/api.interface';

const logger = {
  log: (...args: unknown[]) => console.log('[SessionStore]', ...args),
  warn: (...args: unknown[]) => console.warn('[SessionStore]', ...args),
  error: (...args: unknown[]) => console.error('[SessionStore]', ...args),
};

export type SessionStatus = 'waiting' | 'connected' | 'transferring' | 'completed' | 'expired' | 'rejected';
export type PageStatus = 'creating' | 'waiting' | 'connected' | 'transferring' | 'completed' | 'error';
export type PhotoLocalStatus = 'pending' | 'uploading' | 'done' | 'error';

/**
 * 统一 Session Store —— PC 端和手机端共用同一个状态模型
 * 
 * 状态唯一来源 = 后端 session/status API
 * 两端各自轮询，读到的值自动同步到 store
 * 
 * PC 端额外扩展: 文件夹选择、P2P 接收、服务器中转下载
 * 手机端额外扩展: P2P 发送、本地上传进度
 */
export const useSessionStore = defineStore('session', () => {
  // ========== 核心会话状态（两端共用） ==========
  const code = ref('');
  const desktopToken = ref('');
  const mobileToken = ref('');
  const session = ref<QrSessionInfo | null>(null);
  const photos = ref<QrPhotoInfo[]>([]);
  const pageStatus = ref<PageStatus>('creating');
  const errorMessage = ref('');

  // ========== 轮询 ==========
  let pollTimer: ReturnType<typeof setTimeout> | null = null;
  const POLL_INTERVAL = 2000;

  const startPolling = (mode: 'desktop' | 'mobile') => {
    stopPolling();
    logger.log(`[startPolling] ⚡ 启动 ${mode} 轮询, code=${code.value}, desktopToken=${!!desktopToken.value}, mobileToken=${!!mobileToken.value}`);
    const tick = () => {
      if (!code.value) { logger.warn(`[poll ${mode}] code 为空! 跳过`); return; }
      const promise = mode === 'desktop'
        ? qrTransfer.getSessionStatus(code.value, desktopToken.value)
        : qrTransfer.getSessionStatusPublic(code.value);

      promise.then((res: SessionStatusResponse) => {
        if (res.success && res.data) {
          const s = res.data.session;
          const photos = res.data.photos;
          logger.log(`[poll ${mode}] session=${s.status}, total=${s.totalPhotos}, received=${s.receivedPhotos}, photos.count=${photos.length}`);
          syncFromBackend(s, photos);
        }
      }).catch((err) => {
        logger.warn('poll 失败（不阻塞）', err);
      }).finally(() => {
        // 🔑 只有后端明确停态才停轮询！
        // 不能用 pageStatus 判断——可能还没同步就误停了
        const backendDone = ['completed', 'expired', 'rejected'].includes(session.value?.status ?? '');
        if (!backendDone) {
          logger.log(`[poll ${mode}] 继续轮询 (session=${session.value?.status}, pageStatus=${pageStatus.value})`);
          pollTimer = setTimeout(tick, POLL_INTERVAL);
        } else {
          logger.log(`[poll ${mode}] 后端停态 ${session.value?.status}，停止轮询`);
        }
      });
    };
    tick();
  };

  const stopPolling = () => {
    if (pollTimer !== null) {
      clearTimeout(pollTimer);
      pollTimer = null;
    }
  };

  // ========== 后端数据同步 ==========
  // 🔑 核心原则：后端 session.status 是唯一 source of truth
  // 任何情况下 pageStatus 必须和 session.status 对齐！
  const syncFromBackend = (s: QrSessionInfo, photoList: QrPhotoInfo[]) => {
    session.value = s;
    photos.value = photoList;

    logger.log(`[syncFromBackend] 后端 status=${s.status}, total=${s.totalPhotos}, received=${s.receivedPhotos}, 当前 pageStatus=${pageStatus.value}`);

    // 无条件同步！以后端为准！
    switch (s.status) {
      case 'waiting':
        pageStatus.value = 'waiting';
        break;
      case 'connected':
        pageStatus.value = 'connected';
        break;
      case 'transferring':
        pageStatus.value = 'transferring';
        break;
      case 'completed':
        pageStatus.value = 'completed';
        stopPolling();
        break;
      case 'expired':
        pageStatus.value = 'error';
        errorMessage.value = '会话已过期';
        stopPolling();
        break;
      case 'rejected':
        pageStatus.value = 'error';
        errorMessage.value = '连接已被拒绝';
        stopPolling();
        break;
    }
    logger.log(`[syncFromBackend] ✅ pageStatus → ${pageStatus.value}`);
  };

  // ========== PC 端: 创建会话 ==========
  const createSession = async () => {
    try {
      pageStatus.value = 'creating';
      logger.log('[createSession] 开始调 POST /api/qr/sessions...');
      const res = await qrTransfer.createSession();
      logger.log('[createSession] API 返回:', res.success, res.data?.code);
      if (!res.success || !res.data) throw new Error(res.message || '创建会话失败');
      code.value = res.data.code;
      desktopToken.value = res.data.desktopToken;
      pageStatus.value = 'waiting';
      logger.log('[createSession] ✅ 完成 code=', code.value);
      return res.data;
    } catch (err: unknown) {
      logger.error('[createSession] ❌ 失败:', err);
      const msg = err instanceof Error ? err.message : '创建会话失败';
      errorMessage.value = msg;
      pageStatus.value = 'error';
      throw err;
    }
  };

  // ========== 手机端: 加入会话 ==========
  const mobileJoin = async (sessionCode: string) => {
    code.value = sessionCode;
    try {
      const res: MobileJoinResponse = await qrTransfer.mobileJoin(sessionCode);
      if (res.success && res.data) {
        mobileToken.value = res.data.mobileToken;
        session.value = res.data.session;
        return res.data.session;
      }
      throw new Error(res.message || '加入失败');
    } catch (err: unknown) {
      const msg = err instanceof Error ? err.message : '加入会话失败';
      errorMessage.value = msg;
      pageStatus.value = 'error';
      throw err;
    }
  };

  // ========== 手机端: 批准连接 ==========
  const mobileApprove = async (totalPhotos: number) => {
    if (!code.value || !mobileToken.value) return;
    const res = await qrTransfer.mobileApprove({ code: code.value, mobileToken: mobileToken.value, totalPhotos });
    logger.log('mobileApprove', totalPhotos, res.success);
    return res;
  };

  // ========== PC 端: Ack 照片 ==========
  const desktopAck = async (photoIds: string[]) => {
    if (!code.value || !desktopToken.value || photoIds.length === 0) return;
    const res = await qrTransfer.desktopAck({ code: code.value, desktopToken: desktopToken.value, photoIds });
    logger.log('desktopAck', photoIds.length, res.success);
    return res;
  };

  // ========== PC 端: 标记完成 ==========
  const desktopComplete = async () => {
    if (!code.value || !desktopToken.value) return;
    const res = await qrTransfer.desktopComplete({ code: code.value, desktopToken: desktopToken.value });
    logger.log('desktopComplete', res.success);
    pageStatus.value = 'completed';
    stopPolling();
    return res;
  };

  // ========== 重置 ==========
  const reset = () => {
    stopPolling();
    code.value = '';
    desktopToken.value = '';
    mobileToken.value = '';
    session.value = null;
    photos.value = [];
    pageStatus.value = 'creating';
    errorMessage.value = '';
  };

  // ========== Computed ==========
  const totalPhotos = computed(() => session.value?.totalPhotos ?? 0);
  const receivedPhotos = computed(() => session.value?.receivedPhotos ?? 0);
  const isCompleted = computed(() => session.value?.status === 'completed' || pageStatus.value === 'completed');
  const isError = computed(() => pageStatus.value === 'error');

  return {
    // state
    code, desktopToken, mobileToken, session, photos,
    pageStatus, errorMessage,
    // polling
    startPolling, stopPolling,
    // actions
    syncFromBackend,
    createSession, mobileJoin, mobileApprove,
    desktopAck, desktopComplete,
    reset,
    // computed
    totalPhotos, receivedPhotos, isCompleted, isError,
  };
});
