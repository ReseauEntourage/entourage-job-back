import { forwardRef, Module } from '@nestjs/common';
import { ShortioModule } from 'src/external-services/shortio/shortio.module';
import { QueuesModule } from 'src/queues/producers/queues.module';
import { SmsService } from './sms.service';

@Module({
  imports: [forwardRef(() => QueuesModule), ShortioModule],
  providers: [SmsService],
  exports: [SmsService],
})
export class SmsModule {}
