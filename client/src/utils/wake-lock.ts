/**
 * Wake Lock 工具：防止屏幕息屏/进入节能模式
 * 支持两种 API：
 *   - Screen Wake Lock API（Chrome 84+，防息屏）
 *   - navigator.wakeLock（Safari iOS 15.4+，防后台挂起）
 */

const logger = {
  log: (...args: unknown[]) => console.log('[WakeLock]', ...args),
  warn: (...args: unknown[]) => console.warn('[WakeLock]', ...args),
};

type AnyWakeLock = {
  request: (type?: 'screen') => Promise<{ release: () => Promise<void> } | void>;
};

let activeLocks: Array<{ release: () => Promise<void> | void }> = [];
let visibilityHandlerBound = false;

function getWakeLockApi(): AnyWakeLock | null {
  if (typeof navigator === 'undefined') return null;
  // @ts-ignore
  if ('wakeLock' in navigator) {
    // @ts-ignore
    return navigator.wakeLock;
  }
  return null;
}

/**
 * 防止屏幕息屏。返回一个释放函数（可多次调用）。
 * 每次调 requestWakeLock() 会累加一个 lock。
 */
export async function requestWakeLock(): Promise<() => void> {
  const wakeLock = getWakeLockApi();
  if (!wakeLock) {
    logger.warn('当前浏览器不支持 Wake Lock API');
    return () => {};
  }

  let releaseFn: (() => Promise<void> | void) = () => {};

  try {
    const lock = await wakeLock.request('screen');
    if (lock) {
      releaseFn = () => {
        try { lock.release(); } catch { /* noop */ }
      };
      activeLocks.push({ release: releaseFn });
      logger.log('Wake Lock 已激活，防止息屏');
    } else {
      releaseFn = () => {};
    }
  } catch (err: unknown) {
    const msg = String(err);
    // 常见原因：非安全上下文 / 权限被拒 / 页面不可见
    logger.warn('Wake Lock request 失败:', msg);
    releaseFn = () => {};
  }

  // 绑定 visibilitychange 处理（恢复可见时重新 request，因为浏览器可能自动释放）
  if (!visibilityHandlerBound) {
    visibilityHandlerBound = true;
    document.addEventListener('visibilitychange', () => {
      if (document.visibilityState === 'visible') {
        // 页面从后台回来 → 重新激活一个 Wake Lock
        void requestWakeLock();
      }
    });
  }

  return () => {
    releaseFn();
    // 从 activeLocks 中移除
    const idx = activeLocks.findIndex((l) => l.release === releaseFn);
    if (idx >= 0) activeLocks.splice(idx, 1);
  };
}

/**
 * 释放所有活跃的 Wake Lock
 */
export function releaseAllWakeLocks(): void {
  for (const l of activeLocks) {
    try { l.release(); } catch { /* noop */ }
  }
  activeLocks = [];
  logger.log('所有 Wake Lock 已释放');
}
