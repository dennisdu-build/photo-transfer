<template>
  <div class="min-h-screen w-full bg-gradient-to-b from-zinc-50 to-zinc-100 flex flex-col">
    <input ref="fileInputRef" type="file" accept="image/*" multiple @change="handleFileChange" class="hidden" />
    <input ref="folderInputRef" type="file" webkitdirectory directory multiple @change="handleFolderChange" class="hidden" />
    <div class="flex-1 w-full px-4 sm:px-5 pt-6 sm:pt-8 pb-8 sm:pb-10 flex flex-col" :style="{ paddingBottom: 'max(2rem, env(safe-area-inset-bottom))' }">

      <!-- joining -->
      <div v-if="pageState === 'joining'" class="flex-1 flex flex-col items-center justify-center gap-3 sm:gap-4">
        <div class="w-14 h-14 sm:w-16 sm:h-16 rounded-xl sm:rounded-2xl bg-white shadow-lg shadow-indigo-100 flex items-center justify-center">
          <svg class="w-6 h-6 sm:w-7 sm:h-7 text-indigo-500 animate-spin" fill="none" viewBox="0 0 24 24" stroke="currentColor" stroke-width="2">
            <path stroke-linecap="round" stroke-linejoin="round" d="M4 4v5h.582m15.356 2A8.001 8.001 0 004.582 9m0 0H9m11 11v-5h-.581m0 0a8.003 8.003 0 01-15.357-2m15.357 2H15" />
          </svg>
        </div>
        <p class="text-zinc-500 text-[13px] sm:text-[14px]">正在连接...</p>
      </div>

      <!-- error -->
      <div v-else-if="pageState === 'error'" class="flex-1 flex flex-col items-center justify-center gap-4 sm:gap-5 px-3 sm:px-4">
        <div class="w-16 h-16 sm:w-20 sm:h-20 rounded-xl sm:rounded-2xl bg-red-50 flex items-center justify-center">
          <svg class="w-8 h-8 sm:w-9 sm:h-9 text-red-400" fill="none" viewBox="0 0 24 24" stroke="currentColor" stroke-width="2">
            <path stroke-linecap="round" stroke-linejoin="round" d="M6 18L18 6M6 6l12 12" />
          </svg>
        </div>
        <div class="text-center">
          <h1 class="text-[17px] sm:text-[18px] font-semibold text-zinc-900">无法连接</h1>
          <p class="text-[13px] sm:text-[13px] text-zinc-500 mt-2 max-w-[280px] sm:max-w-[320px]">{{ errorMessage }}</p>
        </div>
      </div>

      <!-- auth -->
      <div v-else-if="pageState === 'auth'" class="flex-1 flex flex-col justify-center gap-6 sm:gap-8">
        <div class="flex flex-col items-center gap-3 sm:gap-4">
          <div class="w-16 h-16 sm:w-20 sm:h-20 rounded-xl sm:rounded-2xl bg-gradient-to-br from-indigo-500 to-indigo-600 flex items-center justify-center shadow-lg shadow-indigo-200">
            <svg class="w-8 h-8 sm:w-10 sm:h-10 text-white" fill="none" viewBox="0 0 24 24" stroke="currentColor" stroke-width="2">
              <path stroke-linecap="round" stroke-linejoin="round" d="M4 16l4.586-4.586a2 2 0 012.828 0L16 16m-2-2l1.586-1.586a2 2 0 012.828 0L20 14m-6-6h.01M6 20h12a2 2 0 002-2V6a2 2 0 00-2-2H6a2 2 0 00-2 2v12a2 2 0 002 2z" />
            </svg>
          </div>
          <div class="text-center mt-1 sm:mt-2">
            <h1 class="text-[18px] sm:text-[20px] font-semibold text-zinc-900">电脑请求连接</h1>
            <p class="text-[13px] sm:text-[14px] text-zinc-500 leading-relaxed mt-2 max-w-[240px] sm:max-w-[260px] mx-auto">确认允许后，可以选择手机相册里的照片传到电脑</p>
          </div>
          <div v-if="session" class="mt-3 sm:mt-4 px-3 sm:px-4 py-1.5 sm:py-2 bg-zinc-100 rounded-full">
            <span class="text-[11px] sm:text-[12px] text-zinc-500">会话码 </span>
            <span class="text-[13px] sm:text-[14px] font-mono font-semibold text-zinc-700">{{ session.code }}</span>
          </div>
        </div>
        <div class="flex flex-col gap-2.5 sm:gap-3">
          <button @click="handleApprove" class="w-full h-11 sm:h-12 text-[14px] sm:text-[15px] font-semibold rounded-xl bg-gradient-to-br from-indigo-500 to-indigo-600 hover:from-indigo-600 hover:to-indigo-700 text-white shadow-md shadow-indigo-200/60">允许连接</button>
          <button @click="handleReject" class="w-full h-11 sm:h-12 text-[14px] sm:text-[15px] font-medium rounded-xl bg-white text-zinc-700 border border-zinc-200">拒绝</button>
        </div>
      </div>

      <!-- selecting -->
      <div v-else-if="pageState === 'selecting'" class="flex-1 flex flex-col gap-5 sm:gap-6">
        <div class="flex flex-col items-center gap-3 sm:gap-4 pt-4 sm:pt-6">
          <div class="w-16 h-16 sm:w-20 sm:h-20 rounded-xl sm:rounded-2xl bg-gradient-to-br from-green-500 to-emerald-600 flex items-center justify-center shadow-lg shadow-green-200">
            <svg class="w-8 h-8 sm:w-10 sm:h-10 text-white" fill="none" viewBox="0 0 24 24" stroke="currentColor" stroke-width="2.5">
              <path stroke-linecap="round" stroke-linejoin="round" d="M5 13l4 4L19 7" />
            </svg>
          </div>
          <div class="text-center mt-1 sm:mt-2">
            <h1 class="text-[18px] sm:text-[20px] font-semibold text-zinc-900">已连接</h1>
            <p class="text-[13px] sm:text-[14px] text-zinc-500 leading-relaxed mt-2">选择要传输的照片</p>
          </div>
        </div>

        <div class="flex flex-col gap-2.5 sm:gap-3">
          <button @click="triggerFileSelect" class="w-full h-12 sm:h-14 bg-gradient-to-br from-indigo-500 to-indigo-600 hover:from-indigo-600 hover:to-indigo-700 text-white rounded-xl sm:rounded-2xl font-semibold shadow-lg shadow-indigo-200/60 flex items-center justify-center gap-2 sm:gap-2.5 text-[14px] sm:text-[15px]">
            <svg class="w-4 h-4 sm:w-5 sm:h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor" stroke-width="2">
              <path stroke-linecap="round" stroke-linejoin="round" d="M4 16v1a3 3 0 003 3h10a3 3 0 003-3v-1m-4-8l-4-4m0 0L8 8m4-4v12" />
            </svg>
            从相册选择照片
          </button>

          <button v-if="supportsFolderSelect" @click="triggerFolderSelect" class="w-full h-11 sm:h-12 bg-white text-indigo-600 rounded-xl border border-indigo-200 text-[13px] sm:text-[14px] font-medium active:bg-indigo-50 flex items-center justify-center gap-2">
            <svg class="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" stroke-width="2"><path stroke-linecap="round" stroke-linejoin="round" d="M3 7v10a2 2 0 002 2h14a2 2 0 002-2V9a2 2 0 00-2-2h-6l-2-2H5a2 2 0 00-2 2z"/></svg>
            选择整个文件夹（一键导出）
          </button>
        </div>

        <!-- Tips -->
        <div class="bg-amber-50 border border-amber-200 rounded-xl px-3.5 py-3 text-[12px] sm:text-[13px] text-amber-800 leading-relaxed">
          <div class="font-semibold mb-1.5">💡 批量导出技巧</div>
          <template v-if="isIOS">
            <div class="space-y-2">
              <div>
                <div class="font-semibold">方法 A：数据线（最推荐，全量导出）</div>
                <div class="mt-0.5">iPhone 插电脑 → 手机点「信任」→ Windows 打开「此电脑」→ iPhone → <b>DCIM</b> 文件夹 → Ctrl+A 全选 → 复制粘贴</div>
              </div>
              <div>
                <div class="font-semibold">方法 B：本网页快速传（几十~几百张）</div>
                <div class="mt-0.5">① iOS「照片」App → 右上角「选择」→ 左上角「全选」<br/>② 分享 → 滑到最右「存储到文件」<br/>③ 回到本网页 →「从相册选择照片」→「浏览」→ 找到刚才存的位置</div>
              </div>
            </div>
          </template>
          <template v-else-if="supportsFolderSelect">
            <div class="space-y-1">
              <div><b>安卓用户：</b>点上面「选择整个文件夹」按钮，选 DCIM/Pictures 即可一键导出全部</div>
            </div>
          </template>
          <template v-else>
            <div class="space-y-1">
              <div>① 点「从相册选择照片」</div>
              <div>② 相册里多选后一次性上传</div>
            </div>
          </template>
        </div>

        <p class="text-center text-[10px] sm:text-[11px] text-zinc-400 mt-auto">同 WiFi 自动走直连 · 支持多选</p>
      </div>

      <!-- uploading -->
      <div v-else-if="pageState === 'uploading'" class="flex-1 flex flex-col gap-4 sm:gap-5">
        <div class="bg-amber-50 border border-amber-200 rounded-xl px-3 py-2.5 flex items-center gap-2.5">
          <div class="w-6 h-6 rounded-full bg-amber-100 flex items-center justify-center shrink-0">
            <svg class="w-3.5 h-3.5 text-amber-600" fill="none" viewBox="0 0 24 24" stroke="currentColor" stroke-width="2.5">
              <path stroke-linecap="round" stroke-linejoin="round" d="M12 6v6m0 0v6m0-6h6m-6 0H6" />
            </svg>
          </div>
          <div class="text-[11px] sm:text-[12px] text-amber-700 leading-relaxed">
            请保持手机屏幕常亮，勿锁屏或退出页面<br/>
            <span class="text-amber-500">（已自动启用屏幕常亮）</span>
          </div>
        </div>
        <div class="bg-white rounded-xl sm:rounded-2xl shadow-sm shadow-zinc-200/50 p-4 sm:p-5 border border-zinc-100">
          <div class="flex items-center justify-between mb-2 sm:mb-3">
            <h1 class="text-[15px] sm:text-[16px] font-semibold text-zinc-900">正在传输</h1>
            <span class="text-[11px] sm:text-[12px] font-medium text-indigo-600 bg-indigo-50 px-2 py-0.5 rounded-full">{{ progressPercent }}%</span>
          </div>
          <div class="w-full h-1.5 bg-zinc-100 rounded-full overflow-hidden">
            <div class="h-full bg-gradient-to-r from-indigo-500 to-indigo-600 rounded-full transition-all duration-500 ease-out" :style="{ width: progressPercent + '%' }" />
          </div>
          <div class="flex items-center justify-between mt-2 sm:mt-2.5">
            <span class="text-[10px] sm:text-[11px] text-zinc-400">{{ doneCount }} / {{ totalCount }} 张</span>
            <span v-if="errorCount > 0" class="text-[10px] sm:text-[11px] text-red-500">{{ errorCount }} 张失败</span>
          </div>
        </div>
        <div class="grid grid-cols-3 sm:grid-cols-4 gap-2 sm:gap-2.5">
          <div v-for="photo in photos" :key="photo.id" class="relative aspect-square rounded-lg sm:rounded-xl overflow-hidden bg-zinc-100 shadow-sm">
            <img :src="photo.previewUrl" alt="" class="w-full h-full object-cover" />
            <div class="absolute top-1 right-1">
              <div v-if="photo.status === 'uploading'" class="w-5 h-5 sm:w-6 sm:h-6 rounded-full bg-indigo-500/90 flex items-center justify-center shadow-sm">
                <svg class="w-2.5 h-2.5 sm:w-3 sm:h-3 text-white animate-spin" fill="none" viewBox="0 0 24 24" stroke="currentColor" stroke-width="3">
                  <path stroke-linecap="round" stroke-linejoin="round" d="M4 4v5h.582m15.356 2A8.001 8.001 0 004.582 9m0 0H9m11 11v-5h-.581" />
                </svg>
              </div>
              <div v-else-if="photo.status === 'done'" class="w-5 h-5 sm:w-6 sm:h-6 rounded-full bg-green-500 flex items-center justify-center shadow-sm">
                <svg class="w-2.5 h-2.5 sm:w-3 sm:h-3 text-white" fill="none" viewBox="0 0 24 24" stroke="currentColor" stroke-width="3">
                  <path stroke-linecap="round" stroke-linejoin="round" d="M5 13l4 4L19 7" />
                </svg>
              </div>
              <div v-else-if="photo.status === 'error'" class="w-5 h-5 sm:w-6 sm:h-6 rounded-full bg-red-500 flex items-center justify-center shadow-sm">
                <svg class="w-2.5 h-2.5 sm:w-3 sm:h-3 text-white" fill="none" viewBox="0 0 24 24" stroke="currentColor" stroke-width="3">
                  <path stroke-linecap="round" stroke-linejoin="round" d="M6 18L18 6M6 6l12 12" />
                </svg>
              </div>
              <div v-else-if="photo.status === 'pending'" class="w-5 h-5 sm:w-6 sm:h-6 rounded-full bg-zinc-500/70 flex items-center justify-center shadow-sm">
                <span class="text-[8px] sm:text-[9px] text-white font-medium">等待</span>
              </div>
            </div>
          </div>
        </div>
        <button v-if="errorCount > 0" @click="handleRetryFailed" class="w-full h-10 sm:h-11 bg-white text-indigo-600 border border-indigo-200 rounded-xl text-[12px] sm:text-[13px] font-medium active:bg-indigo-50 flex items-center justify-center gap-1.5">
          {{ errorCount }} 张失败，点击重试
        </button>
      </div>

      <!-- completed -->
      <div v-else-if="pageState === 'completed'" class="flex-1 flex flex-col items-center justify-center gap-4 sm:gap-5 px-4 sm:px-6">
        <div class="w-20 h-20 sm:w-24 sm:h-24 rounded-xl sm:rounded-2xl bg-gradient-to-br from-green-500 to-emerald-600 flex items-center justify-center shadow-lg shadow-green-200">
          <svg class="w-10 h-10 sm:w-12 sm:h-12 text-white" fill="none" viewBox="0 0 24 24" stroke="currentColor" stroke-width="2.5">
            <path stroke-linecap="round" stroke-linejoin="round" d="M5 13l4 4L19 7" />
          </svg>
        </div>
        <div class="text-center mt-1 sm:mt-2">
          <h1 class="text-[18px] sm:text-[20px] font-semibold text-zinc-900">传输完成</h1>
          <p class="text-[13px] sm:text-[14px] text-zinc-500 mt-2">{{ totalCount }} 张照片已全部发送到电脑</p>
        </div>
      </div>
    </div>
  </div>
</template>

<script setup lang="ts">
import { ref, computed, onMounted, onUnmounted, watch } from 'vue';
import { useRoute } from 'vue-router';
import { useSessionStore } from '@client/src/stores/session';
import { qrTransfer } from '@client/src/api';
import { useWebRtcSender } from '@client/src/composables/use-webrtc-sender';

type PageState = 'joining' | 'auth' | 'selecting' | 'uploading' | 'completed' | 'error';
type PhotoStatus = 'pending' | 'uploading' | 'done' | 'error';

const logger = {
  log: (...args: unknown[]) => console.log('[QR]', ...args),
  warn: (...args: unknown[]) => console.warn('[QR]', ...args),
  error: (...args: unknown[]) => console.error('[QR]', ...args),
};

interface PhotoItem {
  id: string;
  file: File;
  previewUrl: string;
  status: PhotoStatus;
  progress: number;
}

const route = useRoute();
const store = useSessionStore();
const code = computed(() => store.code || (route.params.code as string));
const mobileToken = computed(() => store.mobileToken);
const session = computed(() => store.session);

const pageState = ref<PageState>('joining');
const errorMessage = ref('');
const photos = ref<PhotoItem[]>([]);
const fileInputRef = ref<HTMLInputElement | null>(null);
const folderInputRef = ref<HTMLInputElement | null>(null);
let uploadAborted = false;

const isIOS = computed(() => /iPhone|iPad|iPod/i.test(navigator.userAgent));
const supportsFolderSelect = computed(() =>
  typeof HTMLInputElement !== 'undefined' &&
  'webkitdirectory' in HTMLInputElement.prototype
);

const { connectP2P, sendFiles, stopP2P } = useWebRtcSender();

const isPermanentCode = (c: string): boolean => /^[a-z2-9]{8}$/.test(c);
const setPhotoStatus = (id: string, status: PhotoStatus, progress = 0) => {
  const list = photos.value.map((p) => (p.id === id ? { ...p, status, progress } : p));
  photos.value = list;
};

// ========== 后端状态 → pageState ==========
watch(() => store.session, (s) => {
  if (!s) return;
  if (s.status === 'completed') pageState.value = 'completed';
  else if (s.status === 'expired') { errorMessage.value = '会话已过期'; pageState.value = 'error'; }
  else if (s.status === 'rejected') { errorMessage.value = '连接已被拒绝'; pageState.value = 'error'; }
});

// ========== 服务器中转上传 ==========
const uploadSequence = async (items: PhotoItem[]) => {
  uploadAborted = false;
  const runOne = async (photo: PhotoItem) => {
    if (uploadAborted) return;
    setPhotoStatus(photo.id, 'uploading', 10);
    try {
      await qrTransfer.uploadFileToServer(code.value, mobileToken.value, photo.file, 0);
      setPhotoStatus(photo.id, 'done', 100);
    } catch {
      setPhotoStatus(photo.id, 'error', 0);
    }
  };
  for (let i = 0; i < items.length; i += 3) {
    if (uploadAborted) break;
    await Promise.all(items.slice(i, i + 3).map(runOne));
  }
};

// ========== P2P 全量发送（含元数据上报） ==========
const sendAllP2P = async (list: PhotoItem[]) => {
  let broken = false;
  for (let i = 0; i < list.length; i++) {
    if (uploadAborted || broken) break;
    const photo = list[i];
    setPhotoStatus(photo.id, 'uploading', Math.round((i / list.length) * 50) + 10);
    void qrTransfer.uploadFileToServer(code.value, mobileToken.value, photo.file, i + 1).catch(() => {});
    const r = await sendFiles([photo.file], () => {
      setPhotoStatus(photo.id, 'uploading', Math.round(((i + 1) / list.length) * 80) + 10);
    });
    if (r.sent > 0) setPhotoStatus(photo.id, 'done', 100);
    broken = r.p2pBroken;
  }
  stopP2P();
};

// ========== 连接 P2P（游客模式无限重试，登录模式一次） ==========
const connectP2PWithRetry = async (relayEnabled: boolean): Promise<boolean> => {
  if (!relayEnabled) {
    // 🔒 游客模式：无限重试直到连上（同 WiFi）
    let attempt = 0;
    while (!uploadAborted) {
      attempt++;
      logger.log(`🔒 P2P 尝试 ${attempt}`);
      try { stopP2P(); } catch {}
      await new Promise((r) => setTimeout(r, 300));
      const ok = await connectP2P(code.value, mobileToken.value).then(() => true).catch(() => false);
      if (ok) { logger.log(`✅ P2P 连上（${attempt} 次）`); return true; }
      await new Promise((r) => setTimeout(r, 1500));
    }
    return false;
  } else {
    // 🔓 登录用户：一次尝试，失败走中继
    return connectP2P(code.value, mobileToken.value).then(() => true).catch(() => false);
  }
};

// ========== 事件处理 ==========
const handleApprove = async () => {
  if (!code.value || !mobileToken.value) return;
  try {
    const res = await qrTransfer.mobileApprove({ code: code.value, mobileToken: mobileToken.value, totalPhotos: 0 });
    if (res.success) pageState.value = 'selecting';
    else { errorMessage.value = res.message || '授权失败'; pageState.value = 'error'; }
  } catch { errorMessage.value = '授权失败，请重试'; pageState.value = 'error'; }
};

const handleReject = async () => {
  if (!code.value || !mobileToken.value) return;
  try {
    await qrTransfer.mobileReject(code.value, mobileToken.value);
    errorMessage.value = '已拒绝连接';
    pageState.value = 'error';
  } catch { errorMessage.value = '操作失败，请重试'; }
};

const handleFileChange = async (e: Event) => {
  const files = (e.target as HTMLInputElement).files;
  const list = files ? Array.from(files) : [];
  // Reset input so re-selecting same files works
  if (fileInputRef.value) fileInputRef.value.value = '';
  await startUploadWithFiles(list);
};

const handleFolderChange = async (e: Event) => {
  const files = (e.target as HTMLInputElement).files;
  // Filter to images only — folders may contain .nomedia, .thumbnails, etc.
  const list = files ? Array.from(files).filter((f) => f.type.startsWith('image/')) : [];
  if (folderInputRef.value) folderInputRef.value.value = '';
  if (list.length === 0) {
    errorMessage.value = '该文件夹里没有图片';
    pageState.value = 'error';
    return;
  }
  await startUploadWithFiles(list);
};

const startUploadWithFiles = async (fileList: File[]) => {
  if (fileList.length === 0 || !code.value || !mobileToken.value) return;

  pageState.value = 'uploading';
  try {
    const initialPhotos: PhotoItem[] = fileList.map((file, idx) => ({
      id: `p-${idx}-${Date.now()}-${Math.random().toString(36).slice(2, 7)}`,
      file, previewUrl: URL.createObjectURL(file), status: 'uploading', progress: Math.round((idx / fileList.length) * 10),
    }));
    photos.value = initialPhotos;

    store.startPolling('mobile');
    void qrTransfer.mobileApprove({ code: code.value, mobileToken: mobileToken.value, totalPhotos: fileList.length }).catch(() => {});

    const relayEnabled = store.session?.relayEnabled === true;
    logger.log(relayEnabled ? '🔓 登录用户（P2P+中继）' : '🔒 游客（纯 P2P）');

    const p2pOk = await connectP2PWithRetry(relayEnabled);
    if (p2pOk) {
      await sendAllP2P(initialPhotos);
    } else if (relayEnabled) {
      logger.log('P2P 没连上 → 服务器中继');
      await uploadSequence(initialPhotos);
    } else {
      errorMessage.value = '已取消';
      pageState.value = 'error';
    }
  } catch (err) {
    logger.error('startUploadWithFiles 异常', err);
    if (photos.value.length === 0) { errorMessage.value = '选择照片时出错，请重试'; pageState.value = 'error'; }
  }
};

const handleRetryFailed = () => {
  const failed = photos.value.filter((p) => p.status === 'error');
  if (failed.length > 0) uploadSequence(failed);
};

const triggerFileSelect = () => fileInputRef.value?.click();
const triggerFolderSelect = () => folderInputRef.value?.click();

// ========== Computed ==========
const totalCount = computed(() => photos.value.length);
const doneCount = computed(() => photos.value.filter((p) => p.status === 'done').length);
const errorCount = computed(() => photos.value.filter((p) => p.status === 'error').length);
const progressPercent = computed(() => totalCount.value > 0 ? Math.round((doneCount.value / totalCount.value) * 100) : 0);

// ========== 初始化 ==========
onMounted(async () => {
  const c = route.params.code as string;
  if (!c) { errorMessage.value = '无效的会话码'; pageState.value = 'error'; return; }
  try {
    if (isPermanentCode(c)) {
      const res = await qrTransfer.createSessionFromPermanentCode(c);
      store.code = res.code;
      store.mobileToken = res.mobileToken;
      // 后端没返回 session → 手动构造（永久码 = 登录用户会话 → relayEnabled=true）
      store.session = {
        code: res.code, status: 'connected',
        expiresAt: new Date(Date.now() + 10 * 60 * 1000).toISOString(),
        totalPhotos: 0, receivedPhotos: 0, relayEnabled: true,
      };
      pageState.value = 'selecting';
    } else {
      const sessionInfo = await store.mobileJoin(c);
      if (sessionInfo.status === 'expired' || sessionInfo.status === 'rejected') {
        errorMessage.value = sessionInfo.status === 'expired' ? '会话已过期' : '连接已被拒绝';
        pageState.value = 'error';
      } else {
        pageState.value = 'auth';
      }
    }
  } catch (err: unknown) {
    console.error('mobileJoin failed', err);
    errorMessage.value = isPermanentCode(c) ? '该二维码不存在或已失效' : '无法连接到会话';
    pageState.value = 'error';
  }
});

onUnmounted(() => {
  uploadAborted = true;
  try { stopP2P(); } catch {}
  store.stopPolling();
  photos.value.forEach((p) => p.previewUrl && URL.revokeObjectURL(p.previewUrl));
});
</script>
