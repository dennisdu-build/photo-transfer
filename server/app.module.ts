import { APP_FILTER } from '@nestjs/core';
import { Module } from '@nestjs/common';

import { DatabaseModule } from '@server/database/database.module';
import { GlobalExceptionFilter } from './common/filters/exception.filter';
import { AuthModule } from './modules/auth/auth.module';
import { QrTransferModule } from './modules/qr-transfer/qr-transfer.module';
import { ViewModule } from './modules/view/view.module';
import { ShortcutsModule } from './modules/shortcut/shortcut.module';

@Module({
  imports: [
    DatabaseModule,
    AuthModule,
    QrTransferModule,
    ViewModule,
    ShortcutsModule,
  ],
  providers: [
    {
      provide: APP_FILTER,
      useClass: GlobalExceptionFilter,
    },
  ],
})
export class AppModule {}
