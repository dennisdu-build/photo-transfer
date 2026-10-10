import {
  Controller,
  Post,
  Get,
  Body,
  Param,
  Query,
  Req,
  UseInterceptors,
  UploadedFile,
} from '@nestjs/common';
import { FileInterceptor } from '@nestjs/platform-express';
import type { Request } from 'express';
import type { Express } from 'express';
import fs from 'fs';
import path from 'path';

import type {
  CreateSessionResponse,
  SessionStatusResponse,
  MobileJoinResponse,
  MobileApproveRequest,
  MobileRejectRequest,
  PhotoUploadRequest,
  PhotoUploadResponse,
  DesktopAckRequest,
  DesktopCompleteRequest,
  SimpleResponse,
  SignalRequest,
  SignalResponse,
} from '@shared/api.interface';
import { QrTransferService } from './qr-transfer.service';

const UPLOAD_DIR = path.join(process.cwd(), 'data', 'uploads');
if (!fs.existsSync(UPLOAD_DIR)) {
  fs.mkdirSync(UPLOAD_DIR, { recursive: true });
}

@Controller('api/qr')
export class QrTransferController {
  constructor(private readonly qrTransferService: QrTransferService) {}

  @Post('sessions')
  async createSession(@Req() req: Request): Promise<CreateSessionResponse> {
    const origin = this.getOrigin(req);
    const auth = (req.headers.authorization as string) || '';
    const token = auth.startsWith('Bearer ') ? auth.slice(7) : null;
    return this.qrTransferService.createSession(origin, token || undefined);
  }

  /** 客人扫老板的永久码 → 自动创建会话并加入 */
  @Post('sessions/from-permanent/:permanentCode')
  async createFromPermanent(
    @Param('permanentCode') permanentCode: string,
  ) {
    return this.qrTransferService.createSessionFromPermanentCode(permanentCode);
  }

  @Get('sessions/:code/status')
  async getStatus(
    @Param('code') code: string,
    @Query('desktopToken') desktopToken?: string,
  ): Promise<SessionStatusResponse> {
    return this.qrTransferService.getStatus(code, desktopToken);
  }

  @Post('sessions/:code/join')
  async mobileJoin(
    @Param('code') code: string,
  ): Promise<MobileJoinResponse> {
    return this.qrTransferService.mobileJoin(code);
  }

  @Post('sessions/:code/approve')
  async mobileApprove(
    @Param('code') code: string,
    @Body() body: MobileApproveRequest,
  ): Promise<SessionStatusResponse> {
    return this.qrTransferService.mobileApprove({ ...body, code });
  }

  @Post('sessions/:code/reject')
  async mobileReject(
    @Param('code') code: string,
    @Body() body: MobileRejectRequest,
  ): Promise<SimpleResponse> {
    return this.qrTransferService.mobileReject({ ...body, code });
  }

  /** 直接上传文件（multipart），替代 dataloom.storage */
  @Post('sessions/:code/photos-upload')
  @UseInterceptors(FileInterceptor('file', {
    dest: UPLOAD_DIR,
    limits: { fileSize: 50 * 1024 * 1024 }, // 50MB
  }))
  async uploadPhotoDirect(
    @Param('code') code: string,
    @UploadedFile() file: Express.Multer.File,
    @Body() body: { mobileToken?: string; fileName?: string; fileSize?: string; sortOrder?: string },
    @Req() req: Request,
  ): Promise<PhotoUploadResponse> {
    if (!file) {
      throw new Error('No file uploaded');
    }

    const mobileToken = body.mobileToken ?? '';
    const origin = this.getOrigin(req);
    const savedFileName = file.filename;
    const filePath = `/uploads/${savedFileName}`;
    const downloadUrl = `${origin}${filePath}`;

    return this.qrTransferService.addPhoto({
      code,
      mobileToken,
      fileName: body.fileName ?? file.originalname,
      fileSize: Number(body.fileSize) || file.size,
      downloadUrl,
      filePath: savedFileName,
      bucketId: null,
      sortOrder: Number(body.sortOrder) || 0,
    });
  }

  @Post('sessions/:code/photos')
  async addPhoto(
    @Param('code') code: string,
    @Body() body: PhotoUploadRequest,
  ): Promise<PhotoUploadResponse> {
    return this.qrTransferService.addPhoto({ ...body, code });
  }

  @Post('sessions/:code/ack')
  async desktopAck(
    @Param('code') code: string,
    @Body() body: DesktopAckRequest,
  ): Promise<SessionStatusResponse> {
    return this.qrTransferService.desktopAck({ ...body, code });
  }

  @Post('sessions/:code/complete')
  async desktopComplete(
    @Param('code') code: string,
    @Body() body: DesktopCompleteRequest,
  ): Promise<SimpleResponse> {
    return this.qrTransferService.desktopComplete({ ...body, code });
  }

  // ============ WebRTC 信令 ============

  /** 发送一条信令 + 拉取对方的所有信令 */
  @Post('sessions/:code/signal')
  async sendSignal(
    @Param('code') code: string,
    @Body() body: Omit<SignalRequest, 'code'>,
  ): Promise<SignalResponse> {
    return this.qrTransferService.sendSignal({ ...body, code });
  }

  /** 仅拉取对方发来的所有信令 */
  @Get('sessions/:code/signals')
  async pollSignals(
    @Param('code') code: string,
    @Query('token') token: string,
    @Query('role') role: 'desktop' | 'mobile',
  ): Promise<SignalResponse> {
    return this.qrTransferService.pollSignals(code, token, role);
  }

  private getOrigin(req: Request): string {
    const proto =
      (req.headers['x-forwarded-proto'] as string) || req.protocol || 'https';
    const host = (req.headers['x-forwarded-host'] as string) || req.get('host');
    return `${proto}://${host}`;
  }
}
