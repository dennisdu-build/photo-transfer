import { Controller, Get, Req, Res } from '@nestjs/common';
import type { Request, Response } from 'express';
import { join } from 'path';
import fs from 'fs';

const candidates = [
  join(process.cwd(), 'dist/client/client/index.html'),
  join(process.cwd(), 'dist/client/index.html'),
  join(process.cwd(), 'client/client/index.html'),
  join(process.cwd(), 'client/index.html'),
  join(process.cwd(), '..', 'client/index.html'),
];

// 预找一次 HTML 路径（部署后重启就更新了）
let cachedHtmlPath: string | null = null;
function findHtmlPath(): string | null {
  if (cachedHtmlPath) return cachedHtmlPath;
  cachedHtmlPath = candidates.find((p) => {
    try { return fs.existsSync(p); } catch { return false; }
  }) || null;
  return cachedHtmlPath;
}

// 文件 mtime 感知的缓存：文件没变用缓存，变了自动重新读
let htmlCache: { content: string; mtime: number } | null = null;

function getHtml(): string {
  const htmlPath = findHtmlPath();
  if (!htmlPath) {
    return '<!DOCTYPE html><html><body><h1>Error: index.html not found</h1></body></html>';
  }

  // 读当前文件 mtime
  let currentMtime = 0;
  try { currentMtime = fs.statSync(htmlPath).mtimeMs; } catch { /* 忽略 */ }

  // 缓存命中：文件没变
  if (htmlCache && htmlCache.mtime === currentMtime) {
    return htmlCache.content;
  }

  let html = fs.readFileSync(htmlPath, 'utf-8');

  // 替换 Lark 平台模板占位符为安全默认值
  const replacements: Record<string, string> = {
    '{{appId}}': '',
    '{{userId}}': '',
    '{{tenantId}}': '',
    '{{userName}}': '',
    '{{csrfToken}}': '',
    '{{environment}}': 'production',
    '{{basename}}': '/',
    '{{appName}}': '照片快传助手',
    "{{{__platform__}}}": '{}',
  };
  for (const [from, to] of Object.entries(replacements)) {
    html = html.split(from).join(to);
  }
  html = html.replace(/\{\{[^}]+\}\}/g, '');

  htmlCache = { content: html, mtime: currentMtime };
  return html;
}

@Controller()
export class ViewController {
  @Get('shortcut/backup')
  shortcutBackup(@Req() req: Request, @Res() res: Response): void {
    res.setHeader('Cache-Control', 'no-cache');
    res.type('html').send(`<!DOCTYPE html>
<html lang="zh-CN">
<head>
<meta charset="utf-8" />
<meta name="viewport" content="width=device-width, initial-scale=1, maximum-scale=1" />
<title>照片快传 · iOS 快捷指令安装</title>
<style>
  * { margin: 0; padding: 0; box-sizing: border-box; }
  body { font-family: -apple-system, "PingFang SC", sans-serif; background: linear-gradient(180deg, #ecfdf5 0%, #fafafa 100%); min-height: 100vh; padding: 20px 16px; color: #1f2937; }
  .wrap { max-width: 420px; margin: 0 auto; }
  .hero { text-align: center; padding: 20px 0 24px; }
  .icon { width: 56px; height: 56px; border-radius: 16px; background: linear-gradient(135deg, #10b981, #059669); margin: 0 auto 12px; display: flex; align-items: center; justify-content: center; }
  .icon svg { width: 28px; height: 28px; color: #fff; }
  h1 { font-size: 20px; font-weight: 700; color: #065f46; }
  .sub { font-size: 13px; color: #6b7280; margin-top: 6px; }
  .card { background: #fff; border-radius: 16px; border: 1px solid #d1fae5; padding: 18px; margin-bottom: 14px; box-shadow: 0 1px 3px rgba(0,0,0,0.04); }
  .card h2 { font-size: 14px; font-weight: 700; color: #047857; margin-bottom: 10px; display: flex; align-items: center; gap: 8px; }
  .step-num { width: 22px; height: 22px; border-radius: 50%; background: #10b981; color: #fff; font-size: 12px; font-weight: 700; display: inline-flex; align-items: center; justify-content: center; flex-shrink: 0; }
  .step-list { font-size: 13px; line-height: 1.8; color: #374151; }
  .step-list b { color: #047857; }
  .action { font-size: 12px; color: #6b7280; background: #f9fafb; border-radius: 8px; padding: 10px 12px; margin-top: 10px; font-family: ui-monospace, Menlo, monospace; word-break: break-all; }
  .tip { background: #fef3c7; border: 1px solid #fcd34d; border-radius: 10px; padding: 12px; font-size: 12px; color: #92400e; line-height: 1.7; }
  .tip b { color: #78350f; }
  .action-btn { display: block; width: 100%; padding: 14px; background: linear-gradient(135deg, #10b981, #059669); color: #fff; border: none; border-radius: 12px; font-size: 15px; font-weight: 700; box-shadow: 0 4px 12px rgba(16,185,129,0.3); margin-bottom: 10px; text-decoration: none; text-align: center; }
  .action-btn:active { transform: scale(0.98); }
  .action-btn.ghost { background: #fff; color: #047857; border: 1.5px solid #a7f3d0; box-shadow: none; }
  ul { padding-left: 18px; }
  ul li { margin-bottom: 4px; }
  .footer { text-align: center; font-size: 11px; color: #9ca3af; padding: 12px 0 24px; }
</style>
</head>
<body>
<div class="wrap">
  <div class="hero">
    <div class="icon"><svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5"><path stroke-linecap="round" stroke-linejoin="round" d="M13 10V3L4 14h7v7l9-11h-7z"/></svg></div>
    <h1>照片快传备份快捷指令</h1>
    <div class="sub">一键从 iPhone 相册导出全部照片到电脑</div>
  </div>

  <!-- Step 1: Download -->
  <div class="card">
    <h2><span class="step-num">1</span> 下载并安装快捷指令</h2>
    <p style="font-size:13px; color:#374151; margin-bottom:12px;">点击下方链接，会自动跳转到 iOS 快捷指令 App 安装：</p>
    <a href="https://www.icloud.com/shortcuts/PLACEHOLDER" class="action-btn">📥 下载「照片快传备份」快捷指令</a>
    <p style="font-size:11px; color:#9ca3af; text-align:center;">需要 iOS 15+ · 首次安装如果提示「无法打开」，请先在 iPhone 设置里允许未信任的快捷指令</p>
  </div>

  <!-- Step 2: Build manually fallback -->
  <div class="card">
    <h2><span class="step-num">2</span> 手动构建（备选方案）</h2>
    <p style="font-size:12px; color:#6b7280; margin-bottom:10px;">如果上面的下载链接无法使用，按下面步骤在 iPhone 上手动构建快捷指令：</p>
    <div class="step-list">
      <b>① 新建快捷指令</b><br/>
      打开 iOS 「快捷指令」App → 右上角「+」→ 命名为 <b>照片快传备份</b><br/><br/>
      <b>② 添加 6 个 Action（按顺序）：</b>
      <ul>
        <li><b>Ask for Input</b> — 类型选「Text」，提示词写"服务器参数"</li>
        <li><b>Get Contents of URL</b> — URL 填 <code>{"参数": ""}</code>，方法选 GET（运行时再替换）</li>
        <li><b>Get All Photos</b> — 媒体类型 Images，排序 Newest First，数量 0（全部）</li>
        <li><b>Repeat Each</b> — 重复上面的「Upload File」action</li>
        <li><b>Upload File</b> — URL 从上一个 JSON 取 uploadUrl，文件来自循环变量</li>
        <li><b>Get Contents of URL</b> — 全部传完后调 completeUrl</li>
      </ul>
      <br/>
      <b>③ 参数传递</b><br/>
      快捷指令通过 URL scheme 运行时，JSON 参数会自动传给第一个 action 的输入
    </div>
  </div>

  <!-- Step 3: Run -->
  <div class="card">
    <h2><span class="step-num">3</span> 在电脑端生成会话并运行</h2>
    <div class="step-list">
      <ul>
        <li>电脑端首页 → 点绿色「📱 iPhone 一键全量备份」卡片里的按钮 → 生成备份会话</li>
        <li>电脑端会自动显示 shortcuts:// 链接，点一下手机上就会跳转到快捷指令</li>
        <li>快捷指令自动获取相册全部照片 → 逐张上传到电脑</li>
        <li>电脑端首页实时显示接收进度</li>
      </ul>
    </div>
    <div class="tip" style="margin-top:14px;">
      💡 <b>提示：</b>备份过程中请保持 iPhone 亮屏 + 不要退出快捷指令。几千张照片可能需要几分钟。<br/>
      备份会话有效期 2 小时，中途断了可以在快捷指令里改下参数再跑。
    </div>
  </div>

  <div class="footer">照片快传助手 · Shortcuts 备份</div>
</div>
</body></html>`);
  }

  @Get(['/', '*'])
  render(@Req() req: Request, @Res() res: Response): void {
    const url = req.url.split('?')[0];
    const isPage = url === '/' || /^\/m\/[^/]+$/.test(url);

    if (!isPage) {
      res.status(404).send('Not Found');
      return;
    }

    // 🔑 HTML 禁缓存 —— 每次都拉最新版本（里面引用的 assets 文件名带 hash）
    res.setHeader('Cache-Control', 'no-cache, no-store, must-revalidate');
    res.setHeader('Pragma', 'no-cache');
    res.setHeader('Expires', '0');
    res.type('html').send(getHtml());
  }
}
