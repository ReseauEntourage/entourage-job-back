import { Module } from '@nestjs/common';
import { MailsService } from './mails.service';
import { QueuesModule } from '../queues/producers/queues.module';
import { MailjetService } from './mailjet.service';

@Module({
  imports: [QueuesModule],
  providers: [MailsService, MailjetService],
  exports: [MailsService, MailjetService],
})
export class MailsModule {}
