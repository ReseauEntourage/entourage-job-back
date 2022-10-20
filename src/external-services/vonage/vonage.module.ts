import { Module } from '@nestjs/common';
import { VonageService } from './vonage.service';

@Module({
  providers: [VonageService],
  exports: [VonageService],
})
export class VonageModule {}
