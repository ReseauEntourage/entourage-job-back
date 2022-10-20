import { Module } from '@nestjs/common';
import { MailsModule } from 'src/mails/mails.module';
import { ContactUsFormFactory } from './contact-us-form.factory';

@Module({
  imports: [MailsModule],
  providers: [ContactUsFormFactory],
  exports: [ContactUsFormFactory],
})
export class MailsTestingModule {}
