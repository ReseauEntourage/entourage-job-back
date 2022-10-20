import { Module } from '@nestjs/common';
import { BitlyModule } from 'src/external-services/bitly/bitly.module';
import { VonageModule } from 'src/external-services/vonage/vonage.module';
import { QueuesModule } from 'src/queues/producers';
import { SMSService } from './sms.service';

@Module({
  imports: [QueuesModule, BitlyModule, VonageModule],
  providers: [SMSService],
  exports: [SMSService],
})
export class SMSModule {}
