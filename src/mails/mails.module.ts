import { forwardRef, Module } from '@nestjs/common';
import { QueuesModule } from 'src/queues/producers/queues.module';
import { MailsService } from './mails.service';

@Module({
  imports: [forwardRef(() => QueuesModule)],
  providers: [MailsService],
  exports: [MailsService],
})
export class MailsModule {}
