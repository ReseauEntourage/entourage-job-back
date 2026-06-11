import { forwardRef, Module } from '@nestjs/common';
import { QueuesModule } from 'src/queues/producers/queues.module';
import { SmsService } from './sms.service';

@Module({
  imports: [forwardRef(() => QueuesModule)],
  providers: [SmsService],
  exports: [SmsService],
})
export class SmsModule {}
