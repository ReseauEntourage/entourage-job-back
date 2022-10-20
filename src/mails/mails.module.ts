import { Module } from '@nestjs/common';
import { MailchimpModule } from 'src/external-services/mailchimp/mailchimp.module';
import { QueuesModule } from 'src/queues/producers';
import { MailsController } from './mails.controller';
import { MailsService } from './mails.service';

@Module({
  imports: [QueuesModule, MailchimpModule],
  controllers: [MailsController],
  providers: [MailsService],
  exports: [MailsService],
})
export class MailsModule {}
