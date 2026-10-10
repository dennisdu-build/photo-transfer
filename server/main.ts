import { NestFactory } from '@nestjs/core';
import { Logger } from '@nestjs/common';
import { join } from 'path';
import { NestExpressApplication } from '@nestjs/platform-express';

import { AppModule } from './app.module';

async function bootstrap() {
  const app = await NestFactory.create<NestExpressApplication>(AppModule);

  const logger = new Logger('Bootstrap');
  const host = process.env.SERVER_HOST || '0.0.0.0';
  const port = Number(process.env.SERVER_PORT || '3000');

  // CORS
  app.enableCors({ origin: true, credentials: true });

  // 静态文件：上传的照片
  app.useStaticAssets(join(process.cwd(), 'data', 'uploads'), {
    prefix: '/uploads/',
  });

  // 前端构建产物（assets、favicon 等）
  // 跳过 HTML 请求（由 ViewController 返回带占位符替换的版本）
  app.use((req, res, next) => {
    const url = req.url.split('?')[0];
    if (url.endsWith('.html') || url === '/' || /^\/m\/[^/]+$/.test(url)) {
      // 跳过静态匹配，让 NestJS ViewController 处理（它会给 HTML 加禁缓存头）
    } else {
      // 🔑 assets 长期缓存（文件名带 hash，内容永远不变）
      // 这样浏览器下次直接用本地缓存，不会发请求
      if (url.includes('/assets/') && (url.endsWith('.js') || url.endsWith('.css'))) {
        res.setHeader('Cache-Control', 'public, max-age=31536000, immutable');
      }
      // 尝试 assets 子目录
      const clientDirs = [
        join(process.cwd(), 'dist/client'),
        join(process.cwd(), 'client'),
      ];
      for (const dir of clientDirs) {
        try {
          // 手动检查文件是否存在
          const fs = require('fs');
          const fullPath = join(dir, url);
          if (fs.existsSync(fullPath) && fs.statSync(fullPath).isFile()) {
            return res.sendFile(fullPath);
          }
        } catch { /* continue */ }
      }
    }
    next();
  });

  await app.listen(port, host);
  logger.log(`Server running on http://${host}:${port}`);
  logger.log(`API at /api, Uploads at /uploads/`);
}

bootstrap();
