import { Module } from '@nestjs/common';
import { BitlyModule } from 'src/external-services/bitly/bitly.module';
import { VonageService } from 'src/external-services/vonage/vonage.service';
import { QueuesModule } from 'src/queues/producers';
import { SMSService } from './sms.service';

@Module({
  imports: [QueuesModule, BitlyModule, VonageService],
  providers: [SMSService],
  exports: [SMSService],
})
export class SMSModule {}
