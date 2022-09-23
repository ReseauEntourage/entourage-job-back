import { Module } from '@nestjs/common';
import { MailchimpService } from './mailchimp.service';

@Module({
  providers: [MailchimpService],
  exports: [MailchimpService],
})
export class MailchimpModule {}
