import { Module } from '@nestjs/common';
import { QueuesModule } from 'src/queues/producers';
import { MailsService } from './mails.service';

@Module({
  imports: [QueuesModule],
  providers: [MailsService],
  exports: [MailsService],
})
export class MailsModule {}
