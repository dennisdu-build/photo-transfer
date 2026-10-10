<template>
  <div class="min-h-screen w-full flex flex-col bg-gradient-to-b from-zinc-50 to-zinc-100">

    <!-- ============ HEADER NAV ============ -->
    <header class="sticky top-0 z-50 w-full bg-white/80 backdrop-blur-lg border-b border-zinc-200/60">
      <div class="w-full max-w-6xl mx-auto px-4 sm:px-6 h-14 sm:h-16 flex items-center justify-between">
        <!-- Logo -->
        <div class="flex items-center gap-2.5 shrink-0">
          <div class="w-8 h-8 sm:w-9 sm:h-9 rounded-xl bg-gradient-to-br from-indigo-500 to-indigo-600 flex items-center justify-center shadow-md shadow-indigo-200">
            <svg class="w-4 h-4 sm:w-5 sm:h-5 text-white" fill="none" viewBox="0 0 24 24" stroke="currentColor" stroke-width="2">
              <rect x="3" y="3" width="7" height="7" rx="1" />
              <rect x="14" y="3" width="7" height="7" rx="1" />
              <rect x="3" y="14" width="7" height="7" rx="1" />
              <path d="M14 14h3m0 3h4m-4 0h-3m7 0v3" />
            </svg>
          </div>
          <div class="leading-none">
            <h1 class="text-[15px] sm:text-[16px] font-semibold text-zinc-900">照片快传助手</h1>
            <p class="text-[10px] sm:text-[11px] text-zinc-400 mt-0.5 hidden sm:block">扫码 · 选照片 · 自动存本地</p>
          </div>
        </div>

        <!-- Nav links (桌面) -->
        <nav class="hidden md:flex items-center gap-6">
          <a href="#" class="text-[13px] font-medium text-indigo-600">首页</a>
          <a href="#about" class="text-[13px] text-zinc-500 hover:text-zinc-800 transition-colors">关于</a>
          <a href="#features" class="text-[13px] text-zinc-500 hover:text-zinc-800 transition-colors">功能</a>
          <a href="#faq" class="text-[13px] text-zinc-500 hover:text-zinc-800 transition-colors">常见问题</a>
        </nav>

        <!-- Auth -->
        <div class="flex items-center gap-1 sm:gap-2">
          <template v-if="user">
            <div class="flex items-center gap-1.5 text-[11px] text-zinc-600 px-2.5 py-1 bg-indigo-50 rounded-lg border border-indigo-100">
              <svg class="w-3 h-3 text-indigo-500" fill="none" viewBox="0 0 24 24" stroke="currentColor" stroke-width="2">
                <path stroke-linecap="round" stroke-linejoin="round" d="M16 7a4 4 0 11-8 0 4 4 0 018 0zM12 14a7 7 0 00-7 7h14a7 7 0 00-7-7z" />
              </svg>
              <span class="truncate max-w-[140px] sm:max-w-[180px]">{{ user.shop_name || user.username }}</span>
            </div>
            <button @click="handleLogout" class="text-[12px] text-zinc-500 hover:text-zinc-800 px-2.5 py-1.5 rounded-lg hover:bg-zinc-100 transition-colors">退出</button>
          </template>
          <template v-else>
            <button @click="authMode = 'login'; authError = ''" class="text-[12px] text-zinc-600 hover:text-indigo-600 px-2.5 py-1.5 rounded-lg hover:bg-zinc-50">登录</button>
            <button @click="authMode = 'register'; authError = ''" class="text-[12px] font-medium text-white bg-gradient-to-br from-indigo-500 to-indigo-600 hover:from-indigo-600 hover:to-indigo-700 px-3 py-1.5 rounded-lg shadow-sm shadow-indigo-200">注册</button>
          </template>
        </div>
      </div>
    </header>

    <!-- ============ MAIN ============ -->
    <main class="flex-1 w-full flex flex-col items-center py-6 sm:py-10 px-3 sm:px-6">
      <div class="w-full max-w-3xl flex flex-col items-stretch gap-4 sm:gap-5">
        <div class="bg-white rounded-2xl sm:rounded-3xl shadow-xl shadow-zinc-200/60 p-5 sm:p-7 md:p-8 flex flex-col items-center gap-4 sm:gap-5 md:gap-6 border border-zinc-100">

        <!-- Auth 表单 -->
        <div v-if="authMode !== 'hidden' && !user" class="w-full max-w-[340px] bg-zinc-50/70 backdrop-blur rounded-2xl border border-zinc-100 p-4 sm:p-5 space-y-3">
          <div class="flex items-center justify-between">
            <h3 class="text-[13px] font-semibold text-zinc-800">
              {{ authMode === 'login' ? '登录' : '注册（打印店老板）' }}
            </h3>
            <button @click="authMode = 'hidden'" class="text-zinc-400 hover:text-zinc-600">
              <svg class="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" stroke-width="2">
                <path stroke-linecap="round" stroke-linejoin="round" d="M6 18L18 6M6 6l12 12" />
              </svg>
            </button>
          </div>
          <form @submit.prevent="handleAuthSubmit" class="space-y-2.5" novalidate>
            <div v-if="authError" class="text-[11px] text-red-600 bg-red-50 px-2.5 py-1.5 rounded-lg border border-red-100">{{ authError }}</div>
            <div>
              <label class="text-[10px] text-zinc-500 block mb-1">邮箱（找回密码用）</label>
              <input type="text" v-model="authForm.username" @blur="validateUsername" class="w-full px-3 py-2 text-[13px] bg-white border border-zinc-200 rounded-lg focus:border-indigo-400 focus:outline-none focus:ring-2 focus:ring-indigo-100" />
              <div v-if="authErrors.username" class="text-[10px] text-red-500 mt-1">{{ authErrors.username }}</div>
            </div>
            <div>
              <label class="text-[10px] text-zinc-500 block mb-1">密码（至少 6 位）</label>
              <input type="password" v-model="authForm.password" @blur="validatePassword" class="w-full px-3 py-2 text-[13px] bg-white border border-zinc-200 rounded-lg focus:border-indigo-400 focus:outline-none focus:ring-2 focus:ring-indigo-100" />
              <div v-if="authErrors.password" class="text-[10px] text-red-500 mt-1">{{ authErrors.password }}</div>
            </div>
            <div v-if="authMode === 'register'">
              <label class="text-[10px] text-zinc-500 block mb-1">店铺名（可选）</label>
              <input type="text" v-model="authForm.shopName" maxlength="30" class="w-full px-3 py-2 text-[13px] bg-white border border-zinc-200 rounded-lg focus:border-indigo-400 focus:outline-none focus:ring-2 focus:ring-indigo-100" />
            </div>
            <button type="submit" :disabled="authForm.submitting || !authFormValid" class="w-full mt-1 py-2 text-[12px] font-medium text-white bg-indigo-600 hover:bg-indigo-700 rounded-lg disabled:opacity-50 disabled:cursor-not-allowed">
              {{ authForm.submitting ? '处理中...' : (authMode === 'login' ? '登录' : '注册并获取永久二维码') }}
            </button>
          </form>
          <button @click="authMode = authMode === 'login' ? 'register' : 'login'; authError = ''; authErrors = { username: '', password: '' };" class="w-full text-center text-[11px] text-indigo-600 hover:text-indigo-700">
            {{ authMode === 'login' ? '还没有账号？点此注册' : '已有账号？点此登录' }}
          </button>
        </div>

        <!-- 永久二维码 -->
        <div v-if="user && permQrDataUrl" class="w-full bg-gradient-to-br from-indigo-50 to-zinc-50 rounded-2xl border border-indigo-100 p-4 sm:p-5">
          <div class="flex items-center justify-between mb-3">
            <div>
              <div class="text-[12px] font-semibold text-indigo-700">我的永久二维码</div>
              <div class="text-[10px] text-zinc-500 mt-0.5">贴在店里，客人扫码即可传资料给你</div>
            </div>
          </div>
          <div class="flex items-center gap-3 sm:gap-4">
            <div class="w-[110px] sm:w-[128px] aspect-square bg-white rounded-xl p-2 border border-indigo-100 shrink-0 shadow-sm">
              <img :src="permQrDataUrl" alt="永久二维码" class="w-full h-auto" />
            </div>
            <div class="flex-1 min-w-0 space-y-2">
              <div class="text-[11px] text-zinc-500">永久码</div>
              <div class="text-base sm:text-lg font-mono font-bold text-indigo-700 tracking-widest">{{ user.permanent_code }}</div>
              <div v-if="user.shop_name" class="text-[11px] text-zinc-500 truncate">🏪 {{ user.shop_name }}</div>
              <div class="text-[10px] text-zinc-400 break-all font-mono bg-white/60 rounded px-2 py-1 border border-indigo-100">{{ permQrLink }}</div>
            </div>
          </div>
          <div class="flex items-center gap-2 mt-3 pt-3 border-t border-indigo-100/80">
            <button @click="downloadPermQr" class="flex-1 text-[11px] text-indigo-600 hover:text-indigo-700 px-2.5 py-1.5 bg-white rounded-lg border border-indigo-100 hover:bg-indigo-50 transition-colors">保存到本地</button>
            <div class="relative flex-1">
              <button @click="printMenuOpen = !printMenuOpen" class="w-full text-[11px] text-indigo-600 hover:text-indigo-700 px-2.5 py-1.5 bg-white rounded-lg border border-indigo-100 hover:bg-indigo-50 transition-colors flex items-center justify-center gap-1">
                打印
                <svg class="w-3 h-3" fill="none" viewBox="0 0 24 24" stroke="currentColor" stroke-width="2.5"><path stroke-linecap="round" stroke-linejoin="round" d="M19 9l-7 7-7-7"/></svg>
              </button>
              <div v-if="printMenuOpen" class="absolute bottom-full left-0 right-0 mb-1 bg-white rounded-lg border border-indigo-100 shadow-lg overflow-hidden z-20">
                <button v-for="n in [1, 2, 4]" :key="n" @click="printPermQr(n)" class="w-full text-[11px] text-indigo-600 hover:text-white hover:bg-indigo-500 px-2.5 py-2 text-left transition-colors border-b border-indigo-50 last:border-0">A4 横向 {{ n === 1 ? '单张 (1×1)' : `拼 ${n} 张 (1×${n})` }}</button>
              </div>
            </div>
            <button @click="copyPermLink" class="flex-1 text-[11px] text-indigo-600 hover:text-indigo-700 px-2.5 py-1.5 bg-white rounded-lg border border-indigo-100 hover:bg-indigo-50 transition-colors">复制链接</button>
          </div>
        </div>

        <!-- iOS Shortcuts 备份 -->
        <div v-if="user" class="w-full bg-gradient-to-br from-emerald-50 to-zinc-50 rounded-2xl border border-emerald-100 p-4 sm:p-5">
          <div class="flex items-center gap-2 mb-2">
            <svg class="w-4 h-4 text-emerald-600" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M12 2L2 7l10 5 10-5-10-5zM2 17l10 5 10-5M2 12l10 5 10-5"/></svg>
            <div class="text-[12px] font-semibold text-emerald-700">📱 iPhone 一键全量备份</div>
          </div>
          <div class="text-[10px] text-zinc-500 mb-3">几千张照片一次性导出，用 iOS 快捷指令自动从相册取全部照片</div>

          <template v-if="!shortcutSession">
            <button @click="generateShortcut" :disabled="shortcutLoading" class="w-full h-10 text-[12px] font-semibold rounded-lg bg-gradient-to-br from-emerald-500 to-emerald-600 text-white shadow-sm hover:from-emerald-600 hover:to-emerald-700 disabled:opacity-50 flex items-center justify-center gap-2">
              <svg v-if="shortcutLoading" class="w-3.5 h-3.5 animate-spin" fill="none" viewBox="0 0 24 24" stroke="currentColor" stroke-width="2"><path stroke-linecap="round" stroke-linejoin="round" d="M4 4v5h.582m15.356 2A8.001 8.001 0 004.582 9m0 0H9m11 11v-5h-.581"/></svg>
              {{ shortcutLoading ? '生成中...' : '生成快捷指令备份' }}
            </button>
          </template>

          <template v-else>
            <div class="bg-white rounded-lg border border-emerald-100 p-3 space-y-2">
              <div class="text-[11px] text-zinc-500">📋 操作步骤</div>
              <div class="space-y-1.5 text-[11px] text-zinc-700 leading-relaxed">
                <div>① iPhone 上先安装一次快捷指令：<a :href="`https://${location.host}/shortcut/backup`" target="_blank" class="text-emerald-600 underline">打开这个安装指引页</a></div>
                <div>② 安装好后，手机上点下方按钮运行快捷指令 → 自动获取全部照片</div>
              </div>
              <button @click="openShortcutRun" class="w-full h-9 text-[11px] font-semibold rounded-lg bg-emerald-500 text-white hover:bg-emerald-600 flex items-center justify-center gap-1.5">
                <svg class="w-3.5 h-3.5" fill="none" viewBox="0 0 24 24" stroke="currentColor" stroke-width="2.5"><path stroke-linecap="round" stroke-linejoin="round" d="M14.752 11.168l-3.197-2.132A1 1 0 0010 9.87v4.263a1 1 0 001.555.832l3.197-2.132a1 1 0 000-1.664z"/><path stroke-linecap="round" stroke-linejoin="round" d="M21 12a9 9 0 11-18 0 9 9 0 0118 0z"/></svg>
                在 iPhone 上运行快捷指令
              </button>
              <div class="text-[10px] text-zinc-400 text-center">备份会话 2 小时内有效 · 码 {{ shortcutSession.code }}</div>
              <button @click="shortcutSession = null" class="w-full text-[10px] text-zinc-400 hover:text-zinc-600">✕ 重新生成</button>
            </div>
          </template>
        </div>

        <!-- 二维码区 -->
        <div v-if="showQr" class="w-[180px] sm:w-[220px] md:w-64 aspect-square relative">
          <div class="absolute -inset-2 sm:-inset-3 bg-gradient-to-br from-indigo-100 to-zinc-100 rounded-2xl sm:rounded-3xl blur-xl opacity-60" />
          <div class="relative w-full h-full bg-white rounded-xl sm:rounded-2xl p-3 sm:p-4 md:p-5 border border-zinc-100 shadow-sm">
            <img :src="qrDataUrl" alt="扫码连接" class="w-full h-auto" />
          </div>
        </div>

        <!-- creating -->
        <div v-if="status === 'creating'" class="w-[180px] sm:w-[220px] md:w-64 aspect-square rounded-xl sm:rounded-2xl bg-zinc-100 flex items-center justify-center">
          <div class="w-7 h-7 sm:w-8 sm:h-8 border-[3px] border-zinc-200 border-t-indigo-500 rounded-full animate-spin" />
        </div>

        <!-- error -->
        <div v-if="status === 'error'" class="w-full max-w-[280px] sm:max-w-[320px] h-40 sm:h-48 rounded-xl sm:rounded-2xl bg-red-50 flex flex-col items-center justify-center gap-3">
          <div class="w-12 h-12 sm:w-14 sm:h-14 rounded-full bg-red-100 flex items-center justify-center">
            <svg class="w-6 h-6 sm:w-7 sm:h-7 text-red-500" fill="none" viewBox="0 0 24 24" stroke="currentColor" stroke-width="2">
              <path stroke-linecap="round" stroke-linejoin="round" d="M6 18L18 6M6 6l12 12" />
            </svg>
          </div>
          <p class="text-xs sm:text-sm text-red-600 max-w-[200px] text-center px-2">{{ errorMessage }}</p>
        </div>

        <!-- 会话码 -->
        <div v-if="sessionCode && status !== 'error' && status !== 'creating'" class="text-center w-full">
          <div class="text-[10px] sm:text-[11px] text-zinc-400 tracking-widest mb-1">会话码</div>
          <div class="text-2xl sm:text-3xl font-mono tracking-[0.25em] sm:tracking-[0.3em] font-bold text-zinc-800">{{ sessionCode }}</div>
        </div>

        <!-- 状态 -->
        <div class="flex items-center gap-2 flex-wrap justify-center">
          <span :class="['w-1.5 h-1.5 rounded-full', statusDotColor, status === 'waiting' ? 'animate-pulse' : '']" />
          <p class="text-[12px] sm:text-[13px] text-zinc-500">{{ statusText }}</p>

          <!-- 🔑 用户分层标签 -->
          <span v-if="session?.relayEnabled" class="inline-flex items-center gap-1 px-2 py-0.5 rounded-full bg-indigo-50 text-indigo-700 text-[10px] sm:text-[11px] font-medium border border-indigo-100">
            🔓 已登录 · 支持服务器中继
          </span>
          <span v-else-if="qrDataUrl" class="inline-flex items-center gap-1 px-2 py-0.5 rounded-full bg-zinc-50 text-zinc-600 text-[10px] sm:text-[11px] font-medium border border-zinc-200">
            🔒 游客模式 · 仅同 WiFi
          </span>

          <span v-if="(status === 'connected' || status === 'transferring' || status === 'completed') && p2pStatus === 'connected'" class="inline-flex items-center gap-1 px-2 py-0.5 rounded-full bg-green-50 text-green-700 text-[10px] sm:text-[11px] font-medium border border-green-100">
            <svg class="w-2.5 h-2.5" fill="none" viewBox="0 0 24 24" stroke="currentColor" stroke-width="2.5">
              <path stroke-linecap="round" stroke-linejoin="round" d="M12 15v2m-6 4h12a2 2 0 002-2v-6a2 2 0 00-2-2H6a2 2 0 00-2 2v6a2 2 0 002 2zm10-10V7a4 4 0 00-8 0v4h8z" />
            </svg>
            P2P 直连
          </span>
          <span v-if="(status === 'transferring' || status === 'completed') && p2pStatus === 'failed'" class="inline-flex items-center gap-1 px-2 py-0.5 rounded-full bg-amber-50 text-amber-700 text-[10px] sm:text-[11px] font-medium border border-amber-100">
            <svg class="w-2.5 h-2.5" fill="none" viewBox="0 0 24 24" stroke="currentColor" stroke-width="2">
              <path stroke-linecap="round" stroke-linejoin="round" d="M12 9v2m0 4h.01m-6.938 4h13.856c1.54 0 2.502-1.667 1.732-3L13.732 4c-.77-1.333-2.694-1.333-3.464 0L3.34 16c-.77 1.333.192 3 1.732 3z" />
            </svg>
            服务器中继
          </span>
        </div>

        <!-- 进度条 -->
        <div v-if="showProgress" class="w-full">
          <div class="w-full h-1.5 bg-zinc-100 rounded-full overflow-hidden">
            <div class="h-full bg-gradient-to-r from-indigo-500 to-indigo-600 rounded-full transition-all duration-500 ease-out" :style="{ width: progressPercent + '%' }" />
          </div>
          <div class="flex items-center justify-between mt-2">
            <span class="text-[11px] text-zinc-400">{{ receivedCount }} / {{ totalPhotos }} 张</span>
            <span class="text-[11px] font-medium text-indigo-600">{{ progressPercent }}%</span>
          </div>
        </div>

        <!-- 完成卡片 -->
        <div v-if="status === 'completed'" class="w-full bg-gradient-to-br from-green-50 to-emerald-50 border border-green-100 rounded-xl px-4 sm:px-5 py-3.5 sm:py-4 flex items-center gap-3">
          <div class="w-10 h-10 sm:w-11 sm:h-11 rounded-full bg-green-500 flex items-center justify-center shrink-0 shadow-md shadow-green-200">
            <svg class="w-5 h-5 sm:w-6 sm:h-6 text-white" fill="none" viewBox="0 0 24 24" stroke="currentColor" stroke-width="3">
              <path stroke-linecap="round" stroke-linejoin="round" d="M5 13l4 4L19 7" />
            </svg>
          </div>
          <div class="min-w-0 flex-1">
            <div class="text-[13px] sm:text-[14px] font-semibold text-green-800 leading-tight">全部传输完成 🎉</div>
            <div class="text-[11px] sm:text-[12px] text-green-600 mt-0.5">{{ receivedCount }} 张照片已保存到本地</div>
          </div>
        </div>

        <!-- 文件夹选择 -->
        <div v-if="status !== 'error'" class="w-full">
          <!-- 有文件夹 handle（已选过或已恢复）-->
          <div v-if="dirHandleReady">
            <!-- 完成态 -->
            <div v-if="status === 'completed'" class="bg-gradient-to-br from-green-50 to-emerald-50 border border-green-100 rounded-xl px-4 sm:px-5 py-3.5 sm:py-4">
              <div class="flex items-center gap-2 mb-3">
                <svg class="w-3.5 h-3.5 sm:w-4 sm:h-4 text-green-600" fill="none" viewBox="0 0 24 24" stroke="currentColor" stroke-width="2.5">
                  <path stroke-linecap="round" stroke-linejoin="round" d="M5 13l4 4L19 7" />
                </svg>
                <span class="text-[11px] sm:text-[12px] text-green-700 font-medium">所有文件已保存</span>
              </div>
              <div class="flex items-center gap-2 bg-white/70 rounded-lg px-3 py-2 border border-green-100">
                <svg class="w-4 h-4 sm:w-5 sm:h-5 text-amber-500 shrink-0" fill="none" viewBox="0 0 24 24" stroke="currentColor" stroke-width="2">
                  <path stroke-linecap="round" stroke-linejoin="round" d="M3 7v10a2 2 0 002 2h14a2 2 0 002-2V9a2 2 0 00-2-2h-6l-2-2H5a2 2 0 00-2 2z" />
                </svg>
                <span class="text-[12px] sm:text-[13px] font-mono text-zinc-700 truncate flex-1">{{ folderPathDisplay }}</span>
                <button @click="copyFolderPath" class="text-[10px] sm:text-[11px] text-green-600 hover:text-green-800 shrink-0 px-1.5 py-0.5 rounded hover:bg-green-100 transition">复制</button>
              </div>
            </div>
            <!-- 进行中 / 等待中 -->
            <div v-else class="bg-zinc-50 border border-zinc-100 rounded-xl px-3 sm:px-4 py-2.5 sm:py-3">
              <div class="flex items-center justify-between gap-2">
                <div class="flex items-center gap-2 min-w-0 flex-1">
                  <div :class="['w-6 h-6 sm:w-7 sm:h-7 rounded-lg flex items-center justify-center shrink-0', dirHandle ? 'bg-green-100' : 'bg-blue-100']">
                    <svg :class="['w-3 h-3 sm:w-3.5 sm:h-3.5', dirHandle ? 'text-green-600' : 'text-blue-600']" fill="none" viewBox="0 0 24 24" stroke="currentColor" stroke-width="2.5">
                      <path stroke-linecap="round" stroke-linejoin="round" d="M5 13l4 4L19 7" />
                    </svg>
                  </div>
                  <div class="min-w-0 flex-1">
                    <div class="text-[10px] sm:text-[11px] text-zinc-400 leading-none">本次保存到</div>
                    <div class="text-[12px] sm:text-[13px] font-medium text-zinc-700 truncate mt-0.5">{{ folderName }}</div>
                  </div>
                </div>
                <button v-if="supportsDirectoryPicker()" @click="pickFolder" class="text-[11px] sm:text-[12px] text-indigo-500 hover:text-indigo-700 shrink-0">更换位置</button>
              </div>
              <div v-if="rootFolderName && rootFolderName !== folderName" class="mt-2 pt-2 border-t border-zinc-100 flex items-center gap-1 text-[10px] sm:text-[11px] text-zinc-400">
                <span class="truncate">{{ rootFolderName }} / （自动创建）</span>
              </div>
            </div>
          </div>
        </div>

        <!-- 重新开始 -->
        <button v-if="status === 'error' || status === 'completed'" @click="restart" :class="status === 'completed' ? 'w-full py-2.5 sm:py-3 bg-zinc-100 hover:bg-zinc-200 text-zinc-700 rounded-xl font-medium text-[13px] sm:text-[14px] border border-zinc-200' : 'w-full py-2.5 sm:py-3 bg-gradient-to-br from-indigo-500 to-indigo-600 hover:from-indigo-600 hover:to-indigo-700 text-white rounded-xl font-medium shadow-md shadow-indigo-200/60 text-[13px] sm:text-[14px]'">
          {{ status === 'completed' ? '✅ 传输完成，再来一批' : '重新开始' }}
        </button>
      </div>

      <!-- 照片网格 -->
      <div v-if="showGrid" class="bg-white rounded-2xl sm:rounded-3xl shadow-lg shadow-zinc-200/40 p-4 sm:p-5 border border-zinc-100">
        <div class="flex items-center justify-between mb-3 sm:mb-4">
          <span class="text-[12px] sm:text-[13px] font-medium text-zinc-700">照片列表</span>
          <span class="text-[11px] sm:text-[12px] text-zinc-400">{{ receivedCount }} / {{ totalPhotos }}</span>
        </div>
        <div class="grid grid-cols-3 sm:grid-cols-4 md:grid-cols-5 lg:grid-cols-6 gap-2 sm:gap-2.5">
          <!-- 有 photo 数据：渲染真实状态 -->
          <template v-if="photos.length > 0">
            <div v-for="photo in photos" :key="photo.id" class="relative aspect-square rounded-lg sm:rounded-xl overflow-hidden bg-zinc-100 group">

              <!-- 态1：上传中（手机正在传）→ 灰色占位 -->
              <template v-if="isUploading(photo)">
                <div class="absolute inset-0 bg-gradient-to-br from-zinc-100 to-zinc-200 flex flex-col items-center justify-center gap-1.5">
                  <div class="w-5 h-5 border-[2px] border-zinc-300 border-t-indigo-500 rounded-full animate-spin" />
                  <div class="text-[9px] text-zinc-400">上传中</div>
                </div>
              </template>

              <!-- 态2：下载中 → 缩略图 + 半透明遮罩 + 底部进度条 + 中央百分比 -->
              <template v-else-if="isDownloading(photo)">
                <img v-if="photo.downloadUrl" :src="photo.downloadUrl" :alt="photo.fileName" loading="lazy" class="w-full h-full object-cover opacity-60 blur-[1px]" />
                <div v-else class="w-full h-full bg-gradient-to-br from-zinc-200 to-zinc-300" />
                <!-- 遮罩 -->
                <div class="absolute inset-0 bg-black/20" />
                <!-- 中央百分比 -->
                <div class="absolute inset-0 flex items-center justify-center">
                  <span class="text-[13px] sm:text-sm font-bold text-white drop-shadow-md">{{ photoProgress(photo) }}%</span>
                </div>
                <!-- 底部进度条 -->
                <div class="absolute bottom-0 left-0 right-0 h-1 sm:h-1.5 bg-white/40">
                  <div class="h-full bg-gradient-to-r from-indigo-500 to-indigo-400 transition-all duration-300 ease-out" :style="{ width: photoProgress(photo) + '%' }" />
                </div>
              </template>

              <!-- 态3：已收到 → 清晰缩略图 + 右上角绿对勾 -->
              <template v-else-if="isReceived(photo)">
                <img :src="photo.downloadUrl" :alt="photo.fileName" loading="lazy" class="w-full h-full object-cover" />
                <div class="absolute top-1 right-1 w-4 h-4 sm:w-4.5 sm:h-4.5 bg-green-500 rounded-full flex items-center justify-center shadow-sm ring-2 ring-white">
                  <svg class="w-2.5 h-2.5 sm:w-3 sm:h-3 text-white" fill="none" viewBox="0 0 24 24" stroke="currentColor" stroke-width="3">
                    <path stroke-linecap="round" stroke-linejoin="round" d="M5 13l4 4L19 7" />
                  </svg>
                </div>
              </template>

              <!-- 态4：ready 但还没开始下载 → 缩略图 + 灰色遮罩 + "排队中" -->
              <template v-else>
                <img v-if="photo.downloadUrl" :src="photo.downloadUrl" :alt="photo.fileName" loading="lazy" class="w-full h-full object-cover opacity-50" />
                <div v-else class="w-full h-full bg-gradient-to-br from-zinc-200 to-zinc-300" />
                <div class="absolute inset-0 flex items-center justify-center">
                  <span class="text-[9px] sm:text-[10px] text-zinc-500 bg-white/70 px-1.5 py-0.5 rounded">排队中</span>
                </div>
              </template>

            </div>
          </template>

          <!-- photo 数据还没到：渲染占位方块（数量 = totalPhotos） -->
          <template v-else>
            <div v-for="i in totalPhotos" :key="'placeholder-' + i" class="relative aspect-square rounded-lg sm:rounded-xl overflow-hidden bg-gradient-to-br from-zinc-100 to-zinc-200 flex flex-col items-center justify-center gap-1.5">
              <div class="w-5 h-5 border-[2px] border-zinc-300 border-t-indigo-500 rounded-full animate-spin" />
              <div class="text-[9px] text-zinc-400">等待中</div>
            </div>
          </template>
        </div>
      </div>
      </div>
    </main>

    <!-- ============ FOOTER ============ -->
    <footer class="w-full bg-white border-t border-zinc-200/80 mt-auto">
      <div class="w-full max-w-6xl mx-auto px-4 sm:px-6 py-8 sm:py-12">
        <div class="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-4 gap-8">
          <!-- Brand -->
          <div class="space-y-3 sm:col-span-2 md:col-span-1">
            <div class="flex items-center gap-2.5">
              <div class="w-8 h-8 rounded-xl bg-gradient-to-br from-indigo-500 to-indigo-600 flex items-center justify-center shadow-md shadow-indigo-200">
                <svg class="w-4 h-4 text-white" fill="none" viewBox="0 0 24 24" stroke="currentColor" stroke-width="2">
                  <rect x="3" y="3" width="7" height="7" rx="1" />
                  <rect x="14" y="3" width="7" height="7" rx="1" />
                  <rect x="3" y="14" width="7" height="7" rx="1" />
                  <path d="M14 14h3m0 3h4m-4 0h-3m7 0v3" />
                </svg>
              </div>
              <div>
                <div class="text-[14px] font-semibold text-zinc-900">照片快传助手</div>
                <div class="text-[11px] text-zinc-400">Photo Transfer</div>
              </div>
            </div>
            <p class="text-[12px] text-zinc-500 leading-relaxed max-w-xs">
              纯网页工具，无需安装。手机扫码 → 选照片 → 自动保存到电脑本地文件夹。
            </p>
          </div>

          <!-- 功能 -->
          <div>
            <h4 class="text-[12px] font-semibold text-zinc-800 uppercase tracking-wider mb-3">核心功能</h4>
            <ul class="space-y-2">
              <li class="flex items-center gap-2 text-[12px] text-zinc-500 hover:text-zinc-700 transition-colors">
                <svg class="w-3.5 h-3.5 text-green-500" fill="none" viewBox="0 0 24 24" stroke="currentColor" stroke-width="3">
                  <path stroke-linecap="round" stroke-linejoin="round" d="M5 13l4 4L19 7" />
                </svg>
                WebRTC P2P 直连
              </li>
              <li class="flex items-center gap-2 text-[12px] text-zinc-500 hover:text-zinc-700 transition-colors">
                <svg class="w-3.5 h-3.5 text-green-500" fill="none" viewBox="0 0 24 24" stroke="currentColor" stroke-width="3">
                  <path stroke-linecap="round" stroke-linejoin="round" d="M5 13l4 4L19 7" />
                </svg>
                自动存本地文件夹
              </li>
              <li class="flex items-center gap-2 text-[12px] text-zinc-500 hover:text-zinc-700 transition-colors">
                <svg class="w-3.5 h-3.5 text-green-500" fill="none" viewBox="0 0 24 24" stroke="currentColor" stroke-width="3">
                  <path stroke-linecap="round" stroke-linejoin="round" d="M5 13l4 4L19 7" />
                </svg>
                永久二维码（打印店）
              </li>
              <li class="flex items-center gap-2 text-[12px] text-zinc-500 hover:text-zinc-700 transition-colors">
                <svg class="w-3.5 h-3.5 text-green-500" fill="none" viewBox="0 0 24 24" stroke="currentColor" stroke-width="3">
                  <path stroke-linecap="round" stroke-linejoin="round" d="M5 13l4 4L19 7" />
                </svg>
                无需注册可用
              </li>
            </ul>
          </div>

          <!-- 技术 -->
          <div>
            <h4 class="text-[12px] font-semibold text-zinc-800 uppercase tracking-wider mb-3">技术栈</h4>
            <ul class="space-y-2 text-[12px] text-zinc-500">
              <li>Vue 3 + Vite 8</li>
              <li>WebRTC DataChannel</li>
              <li>File System Access API</li>
              <li>Node.js / NestJS</li>
              <li>SQLite (sql.js)</li>
            </ul>
          </div>

          <!-- 关于 -->
          <div>
            <h4 class="text-[12px] font-semibold text-zinc-800 uppercase tracking-wider mb-3">关于</h4>
            <ul class="space-y-2">
              <li><a href="#about" class="text-[12px] text-zinc-500 hover:text-indigo-600 transition-colors">项目介绍</a></li>
              <li><a href="#privacy" class="text-[12px] text-zinc-500 hover:text-indigo-600 transition-colors">隐私说明</a></li>
              <li><a href="#faq" class="text-[12px] text-zinc-500 hover:text-indigo-600 transition-colors">常见问题</a></li>
            </ul>
          </div>
        </div>

        <!-- 分隔线 + 版权 -->
        <div class="mt-8 sm:mt-10 pt-6 border-t border-zinc-200 flex flex-col sm:flex-row items-center justify-between gap-3">
          <p class="text-[11px] sm:text-[12px] text-zinc-400">
            © 2026 照片快传助手 · 纯网页 · 无需安装 · 隐私安全
          </p>
          <p class="text-[10px] sm:text-[11px] text-zinc-400">
            用 ❤️ Vue 3 · 同 WiFi 直连更快
          </p>
        </div>
      </div>
    </footer>

    <!-- ============ 🔑 覆盖层：照片到达但没选文件夹 → 强制用户点一下 ============ -->
    <div v-if="needsPickFolder" class="fixed inset-0 z-[100] bg-black/50 backdrop-blur-sm flex items-center justify-center px-4">
      <div class="w-full max-w-md bg-white rounded-2xl shadow-2xl p-6 sm:p-8 flex flex-col items-center gap-5 animate-in fade-in zoom-in duration-200">
        <div class="w-14 h-14 sm:w-16 sm:h-16 rounded-2xl bg-gradient-to-br from-indigo-500 to-indigo-600 flex items-center justify-center shadow-lg shadow-indigo-200">
          <svg class="w-7 h-7 sm:w-8 sm:h-8 text-white" fill="none" viewBox="0 0 24 24" stroke="currentColor" stroke-width="2">
            <path stroke-linecap="round" stroke-linejoin="round" d="M3 7v10a2 2 0 002 2h14a2 2 0 002-2V9a2 2 0 00-2-2h-6l-2-2H5a2 2 0 00-2 2z" />
          </svg>
        </div>
        <div class="text-center">
          <h3 class="text-[17px] sm:text-[18px] font-semibold text-zinc-900">📥 照片正在到达！</h3>
          <p class="text-[13px] sm:text-[14px] text-zinc-500 mt-2 leading-relaxed">
            请选择一个本地文件夹来保存<br/>
            <span class="text-indigo-600 font-medium">选完后自动创建子文件夹 · 只需要这一次</span>
          </p>
        </div>
        <button @click="pickFolder" class="w-full h-12 sm:h-13 bg-gradient-to-br from-indigo-500 to-indigo-600 hover:from-indigo-600 hover:to-indigo-700 text-white rounded-xl font-semibold text-[14px] sm:text-[15px] shadow-md shadow-indigo-200 flex items-center justify-center gap-2 transition-all active:scale-[0.98]">
          <svg class="w-4 h-4 sm:w-5 sm:h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor" stroke-width="2.5">
            <path stroke-linecap="round" stroke-linejoin="round" d="M12 4v16m8-8H4" />
          </svg>
          选择保存位置
        </button>
        <p class="text-[10px] sm:text-[11px] text-zinc-400 text-center">
          只弹这一次 · 之后打开自动恢复 · 不会再弹窗
        </p>
      </div>
    </div>

  </div>
</template>

<script setup lang="ts">
import { ref, computed, onMounted, watch } from 'vue';
import QRCode from 'qrcode';
import * as api from '@client/src/api';
import { useQrSession } from '@client/src/composables/use-qr-session';
import { supportsDirectoryPicker } from '@client/src/pages/HomePage/file-saver';
import type { AuthUser } from '@client/src/api';
import type { QrPhotoInfo } from '@shared/api.interface';

const origin = window.location.origin;

const user = ref<AuthUser | null>(null);
const authMode = ref<'hidden' | 'login' | 'register'>('hidden');
const authError = ref('');
const permQrDataUrl = ref('');
const printMenuOpen = ref(false);
const authForm = ref({ username: '', password: '', shopName: '', submitting: false });
const authErrors = ref<{ username: string; password: string }>({ username: '', password: '' });

const EMAIL_RE = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

function validateUsername(): string {
  const v = authForm.value.username.trim();
  if (!v) return (authErrors.value.username = '请输入邮箱');
  if (!EMAIL_RE.test(v)) return (authErrors.value.username = '请输入有效的邮箱地址');
  if (v.length > 60) return (authErrors.value.username = '邮箱太长');
  authErrors.value.username = '';
  return '';
}

function validatePassword(): string {
  const v = authForm.value.password;
  if (!v) return (authErrors.value.password = '请输入密码');
  if (v.length < 6) return (authErrors.value.password = '至少 6 位');
  if (v.length > 64) return (authErrors.value.password = '最多 64 位');
  authErrors.value.password = '';
  return '';
}

const authFormValid = computed(() => {
  const u = authForm.value.username.trim();
  const p = authForm.value.password;
  if (!u || !p) return false;
  if (!EMAIL_RE.test(u)) return false;
  if (u.length > 60) return false;
  if (p.length < 6 || p.length > 64) return false;
  return true;
});

watch(() => authForm.value.username, () => { if (authErrors.value.username) validateUsername(); });
watch(() => authForm.value.password, () => { if (authErrors.value.password) validatePassword(); });

onMounted(async () => {
  const u = await api.auth.me();
  if (u) user.value = u;
});

const generateUserQr = async () => {
  if (!user.value) { permQrDataUrl.value = ''; return; }
  const url = `${origin}/m/${user.value.permanent_code}`;
  const dataUrl = await QRCode.toDataURL(url, { width: 256, margin: 2, errorCorrectionLevel: 'M' });
  permQrDataUrl.value = dataUrl;
};
watch(user, generateUserQr, { immediate: true });

const permQrLink = computed(() => user.value ? `${origin}/m/${user.value.permanent_code}` : '');

const copyPermLink = async () => {
  try { await navigator.clipboard.writeText(permQrLink.value); } catch { /* noop */ }
};

const handleAuthSubmit = async () => {
  authError.value = '';
  const uErr = validateUsername();
  const pErr = validatePassword();
  if (uErr || pErr) return;
  if (!authFormValid.value) return;
  authForm.value.submitting = true;
  try {
    const res = authMode.value === 'login'
      ? await api.auth.login(authForm.value.username, authForm.value.password)
      : await api.auth.register(authForm.value.username, authForm.value.password, authMode.value === 'register' ? authForm.value.shopName || undefined : undefined);
    api.setToken(res.token);
    user.value = res.user;
    authMode.value = 'hidden';
    // 刷新永久二维码
    await generateUserQr();
  } catch (e: unknown) {
    let msg = e instanceof Error ? e.message : '操作失败';
    // 尝试解析 AxiosError 的后端响应
    const anyE = e as { response?: { data?: { message?: string; error?: string } } };
    const backendMsg = anyE?.response?.data?.message || anyE?.response?.data?.error;
    if (backendMsg) msg = backendMsg;
    authError.value = msg;
  } finally {
    authForm.value.submitting = false;
  }
};

const handleLogout = () => {
  api.clearToken();
  user.value = null;
  // 🔑 登出后也要 restart，清掉已创建的登录会话
  void restart();
};

// 🔑 用户登录/注册成功 → 自动 restart（重建带 JWT 的会话）
watch(user, (u) => {
  if (u) {
    void restart();
  }
});

const buildPermQrCanvas = async (): Promise<HTMLCanvasElement | null> => {
  if (!permQrDataUrl.value || !user.value) return null;
  const label = user.value.shop_name || '';
  const img = new Image();
  img.crossOrigin = 'anonymous';
  await new Promise((r) => { img.onload = r; img.src = permQrDataUrl.value; });
  const pad = 32;
  const labelH = label ? 56 : 0;
  const canvas = document.createElement('canvas');
  canvas.width = img.width + pad * 2;
  canvas.height = img.height + pad * 2 + labelH;
  const ctx = canvas.getContext('2d')!;
  ctx.fillStyle = '#ffffff';
  ctx.fillRect(0, 0, canvas.width, canvas.height);
  if (label) {
    ctx.fillStyle = '#1e293b';
    ctx.font = 'bold 28px -apple-system, "PingFang SC", "Microsoft YaHei", sans-serif';
    ctx.textAlign = 'center';
    ctx.textBaseline = 'middle';
    ctx.fillText(label, canvas.width / 2, pad + labelH / 2);
  }
  ctx.drawImage(img, pad, pad + labelH);
  return canvas;
};

const downloadPermQr = async () => {
  const canvas = await buildPermQrCanvas();
  if (!canvas || !user.value) return;
  const label = user.value.shop_name || '';
  const a = document.createElement('a');
  a.href = canvas.toDataURL('image/png');
  a.download = `照片快传-${label || user.value.username}.png`;
  a.click();
};

const printPermQr = (copies = 4) => {
  printMenuOpen.value = false;
  if (!permQrDataUrl.value || !user.value) return;
  const label = user.value.shop_name || '';

  const MARGIN_MM = 10;
  const GAP_MM = 2;

  const w = window.open('', '_blank');
  if (!w) return;
  const qrImg = permQrDataUrl.value;
  const shop = label;
  const shopFont = copies <= 2 ? '20pt' : copies === 3 ? '14pt' : '10pt';
  const qrSize = 'min(72%, 100mm)'; // relative to card width, caps to 100mm for 1x1
  const tipHtml = `
    <div class="tip">💡 打印前：点右上角 <b>更多设置</b> → 取消勾选 <b>页眉和页脚</b>，让纸张更干净</div>`;
  const sheetHtml = `
<style>
  @page { size: A4 landscape; margin: ${MARGIN_MM}mm; }
  * { margin: 0; padding: 0; box-sizing: border-box; }
  html, body { width: 100%; height: 100%; font-family: -apple-system, "PingFang SC", "Microsoft YaHei", sans-serif; }
  .tip { display: none; }
  .sheet { width: 100%; height: 100%; }
  .grid {
    display: grid;
    grid-template-columns: repeat(${copies}, 1fr);
    grid-template-rows: 1fr;
    gap: ${GAP_MM}mm;
    width: 100%;
    height: 100%;
  }
  .card {
    display: flex; flex-direction: column; align-items: center; justify-content: center;
    border: 1px dashed #aaa; border-radius: 2mm;
    padding: 6mm 4mm; background: #fff;
    overflow: hidden;
    -webkit-print-color-adjust: exact; print-color-adjust: exact;
  }
  .card .shop { font-size: ${shopFont}; font-weight: 700; color: #1e293b; text-align: center; margin-bottom: 4mm; max-width: 100%; overflow: hidden; text-overflow: ellipsis; white-space: nowrap; }
  .card .qr-wrap { width: ${qrSize}; aspect-ratio: 1; margin-bottom: 0; }
  .card .qr-wrap img { width: 100%; height: 100%; display: block; image-rendering: crisp-edges; }
  @media screen {
    body { background: #f0f0f0; padding: 20px; height: auto; }
    .sheet {
      width: 297mm; height: 210mm; margin: 0 auto;
      box-shadow: 0 2px 10px rgba(0,0,0,.15);
    }
    .tip {
      display: block; max-width: 297mm; margin: 0 auto 12px;
      font-size: 12px; color: #b45309; background: #fef3c7; border: 1px solid #fcd34d;
      border-radius: 6px; padding: 8px 12px;
    }
  }
  @media print {
    body { background: #fff; }
    .sheet { page-break-after: always; }
    .sheet:last-child { page-break-after: auto; }
  }
</style>
${copies > 1 ? tipHtml : ''}
<div class="sheet"><div class="grid">
  ${Array.from({ length: copies }).map(() => `
    <div class="card">
      ${shop ? `<div class="shop">${shop}</div>` : ''}
      <div class="qr-wrap"><img src="${qrImg}"/></div>
    </div>`).join('')}
</div></div>
<script>window.onload=function(){setTimeout(function(){window.print();},300);}<\/script>`;
  w.document.write('<!DOCTYPE html><html><head><meta charset="utf-8"><title>打印永久二维码</title>' + sheetHtml.replace(/<\/script>/g, '<\\/script>') + '</head><body>' + '</body></html>');
  w.document.close();
};

// ============ Shortcuts 备份 ============
import type { ShortcutBackupSession } from '@client/src/api/qr-transfer';
const shortcutLoading = ref(false);
const shortcutSession = ref<ShortcutBackupSession | null>(null);

const generateShortcut = async () => {
  if (!user.value) return;
  shortcutLoading.value = true;
  try {
    const res = await api.qrTransfer.createShortcutSession();
    if (res.success) {
      shortcutSession.value = res.data;
    }
  } catch (err: unknown) {
    const msg = (err as { response?: { data?: { message?: string } } })?.response?.data?.message || '生成失败';
    alert(msg);
  } finally {
    shortcutLoading.value = false;
  }
};

const openShortcutRun = () => {
  if (!shortcutSession.value) return;
  // Shortcuts URL scheme: 快捷指令名 → 传 JSON 参数
  const params = encodeURIComponent(JSON.stringify({
    shortcutId: shortcutSession.value.shortcutId,
    code: shortcutSession.value.code,
    mobileToken: shortcutSession.value.mobileToken,
    serverUrl: shortcutSession.value.serverUrl,
    uploadUrl: shortcutSession.value.uploadUrl,
    completeUrl: shortcutSession.value.completeUrl,
  }));
  const url = `shortcuts://run-shortcut?name=${encodeURIComponent('照片快传备份')}&input=text&text=${params}`;
  window.location.href = url;
};

// ============ Session ============
const {
  status, errorMessage, qrDataUrl, sessionCode, session, photos,
  receivedPhotoIds, downloadingPhotoIds, downloadProgress, p2pProgress,
  folderReady, rootFolderName, folderName, hasFolderHandle, needsPickFolder,
  p2pStatus, p2pReceivedCount, pickFolder, restart,
} = useQrSession();
// 模板别名
const dirHandleReady = folderReady;
const dirHandle = hasFolderHandle;

const totalPhotos = computed(() => session.value?.totalPhotos || 0);
const serverReceived = computed(() => receivedPhotoIds.value.size);
const receivedCount = computed(() => Math.max(serverReceived.value, p2pReceivedCount.value));
const progressPercent = computed(() => totalPhotos.value > 0 ? Math.round((receivedCount.value / totalPhotos.value) * 100) : 0);
const showQr = computed(() => authMode.value === 'hidden' && status.value !== 'creating' && status.value !== 'error' && !!qrDataUrl.value);
const showProgress = computed(() => status.value === 'transferring' && totalPhotos.value > 0);
const showGrid = computed(() => (status.value === 'connected' || status.value === 'transferring' || status.value === 'completed') && session.value?.totalPhotos && session.value.totalPhotos > 0);

const statusText = computed(() => {
  switch (status.value) {
    case 'creating': return '正在创建会话...';
    case 'waiting': return '等待手机扫码连接';
    case 'connected': return '手机已连接，等待选择照片';
    case 'transferring': return `正在接收照片 (${receivedCount.value} / ${totalPhotos.value})`;
    case 'completed': return '全部传输完成';
    case 'error': return errorMessage.value;
    default: return '';
  }
});

const statusDotColor = computed(() => {
  if (status.value === 'error') return 'bg-red-500';
  if (status.value === 'completed') return 'bg-green-500';
  if (status.value === 'transferring') return 'bg-indigo-500';
  if (status.value === 'connected') return 'bg-blue-500';
  return 'bg-zinc-400';
});

const isReceived = (photo: QrPhotoInfo) => receivedPhotoIds.value.has(photo.id);
const isDownloading = (photo: QrPhotoInfo) => {
  if (receivedPhotoIds.value.has(photo.id)) return false;
  if (p2pProgress.has(photo.fileName)) return true;
  if (downloadingPhotoIds.value.has(photo.id) || downloadProgress.has(photo.id)) return true;
  return false;
};
const isUploading = (photo: QrPhotoInfo) => photo.status === 'uploading' && !isReceived(photo);

const folderPathDisplay = computed(() => {
  if (!hasFolderHandle.value) return `浏览器默认下载 / ${folderName.value}`;
  if (rootFolderName.value && rootFolderName.value !== folderName.value) return `${rootFolderName.value} / ${folderName.value}`;
  return folderName.value;
});

const copyFolderPath = async () => {
  try {
    await navigator.clipboard.writeText(folderPathDisplay.value);
  } catch {
    const ta = document.createElement('textarea');
    ta.value = folderPathDisplay.value; document.body.appendChild(ta); ta.select();
    try { document.execCommand('copy'); } catch {}
    document.body.removeChild(ta);
  }
};

// 每照片进度（优先 P2P，其次服务器中转）
const photoProgress = (photo: QrPhotoInfo): number => {
  if (p2pProgress.has(photo.fileName)) return p2pProgress.get(photo.fileName)!;
  if (downloadProgress.has(photo.id)) return downloadProgress.get(photo.id)!;
  return 0;
};
</script>
