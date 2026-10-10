import {
  Controller,
  Post,
  Get,
  Body,
  Param,
  Req,
  UseInterceptors,
  UploadedFile,
} from '@nestjs/common';
import { FileInterceptor } from '@nestjs/platform-express';
import type { Request } from 'express';
import type { Express } from 'express';

import { ShortcutsService } from './shortcut.service';

const UPLOAD_DIR = 'data/uploads';

@Controller('api/shortcut')
export class ShortcutsController {
  constructor(private readonly shortcutsService: ShortcutsService) {}

  /**
   * 电脑端（已登录用户）请求创建一个 Shortcuts 备份 session
   * 返回 code + mobileToken + uploadUrl，直接塞给 shortcuts:// URL
   */
  @Post('sessions')
  async createShortcutSession(@Req() req: Request) {
    const origin = this.getOrigin(req);
    const auth = (req.headers.authorization as string) || '';
    const token = auth.startsWith('Bearer ') ? auth.slice(7) : null;
    return this.shortcutsService.createSession(origin, token || undefined);
  }

  /** Shortcuts 运行时拉取配置（uploadUrl, code, mobileToken） */
  @Get('config/:shortcutId')
  async getConfig(@Param('shortcutId') shortcutId: string, @Req() req: Request) {
    const origin = this.getOrigin(req);
    return this.shortcutsService.getConfig(shortcutId, origin);
  }

  /** Shortcuts 专用上传（和 photos-upload 一模一样，只是鉴权用 shortcutId） */
  @Post('upload/:shortcutId')
  @UseInterceptors(FileInterceptor('file', {
    dest: UPLOAD_DIR,
    limits: { fileSize: 100 * 1024 * 1024 }, // 100MB（RAW/HEIC 原图可能大）
  }))
  async uploadPhoto(
    @Param('shortcutId') shortcutId: string,
    @UploadedFile() file: Express.Multer.File,
    @Body() body: { fileName?: string; fileSize?: string; sortOrder?: string },
    @Req() req: Request,
  ) {
    if (!file) throw new Error('No file uploaded');
    const origin = this.getOrigin(req);
    return this.shortcutsService.addPhoto({
      shortcutId,
      file,
      fileName: body.fileName ?? file.originalname,
      fileSize: Number(body.fileSize) || file.size,
      sortOrder: Number(body.sortOrder) || 0,
      origin,
    });
  }

  /** Shortcuts 全部传完 → 通知电脑端完成 */
  @Post('complete/:shortcutId')
  async markComplete(@Param('shortcutId') shortcutId: string) {
    return this.shortcutsService.markComplete(shortcutId);
  }

  private getOrigin(req: Request): string {
    const forwarded = req.headers['x-forwarded-proto'] as string | undefined;
    const proto = forwarded ?? (req.protocol === 'https' ? 'https' : 'http');
    const host = req.headers['x-forwarded-host'] ?? req.headers.host ?? '';
    return `${proto}://${host}`;
  }
}
