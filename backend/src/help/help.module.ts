import { Module } from '@nestjs/common';
import { HelpService } from './help.service';
import { HelpController } from './help.controller';

@Module({
  providers: [HelpService],
  controllers: [HelpController],
  exports: [HelpService],
})
export class HelpModule {}
