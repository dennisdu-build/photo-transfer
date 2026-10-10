import { Module } from '@nestjs/common';
import { QrTransferController } from './qr-transfer.controller';
import { QrTransferService } from './qr-transfer.service';

@Module({
  controllers: [QrTransferController],
  providers: [QrTransferService],
})
export class QrTransferModule {}
