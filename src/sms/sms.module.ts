import { Module } from '@nestjs/common';
import { QueuesModule } from 'src/queues/producers';
import { SMSService } from './sms.service';
import { VonageService } from './vonage.service';

@Module({
  imports: [QueuesModule],
  providers: [SMSService, VonageService],
  exports: [SMSService],
})
export class SMSModule {}
