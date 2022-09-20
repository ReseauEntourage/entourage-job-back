import { Module } from '@nestjs/common';
import { BitlyService } from './bitly.service';

@Module({
  providers: [BitlyService],
  exports: [BitlyService],
})
export class BitlyModule {}
