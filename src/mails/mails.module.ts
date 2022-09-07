import { Module } from '@nestjs/common';
import { QueuesModule } from 'src/queues/producers';
import { MailchimpService } from './mailchimp.service';
import { MailjetService } from './mailjet.service';
import { MailsController } from './mails.controller';
import { MailsService } from './mails.service';

@Module({
  imports: [QueuesModule],
  controllers: [MailsController],
  providers: [MailsService, MailjetService, MailchimpService],
  exports: [MailsService, MailjetService, MailchimpService],
})
export class MailsModule {}
