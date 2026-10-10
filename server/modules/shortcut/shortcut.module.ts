import { Module } from '@nestjs/common';
import { ShortcutsController } from './shortcut.controller';
import { ShortcutsService } from './shortcut.service';

@Module({
  controllers: [ShortcutsController],
  providers: [ShortcutsService],
  exports: [ShortcutsService],
})
export class ShortcutsModule {}
