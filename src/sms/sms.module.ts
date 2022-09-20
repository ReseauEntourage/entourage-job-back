import { Module } from '@nestjs/common';
import { BitlyModule } from 'src/bitly/bitly.module';
import { QueuesModule } from 'src/queues/producers';
import { SMSService } from './sms.service';
import { VonageService } from './vonage.service';

@Module({
  imports: [QueuesModule, BitlyModule],
  providers: [SMSService, VonageService],
  exports: [SMSService],
})
export class SMSModule {}
