import { Module } from '@nestjs/common';
import { QueuesModule } from 'src/queues/producers/queues.module';
import { MailjetService } from './mailjet.service';
import { MailsService } from './mails.service';

@Module({
  imports: [QueuesModule],
  providers: [MailsService, MailjetService],
  exports: [MailsService, MailjetService],
})
export class MailsModule {}
