import { Module } from '@nestjs/common';
import { MailsModule } from 'src/mails/mails.module';
import { ContactCompanyFormFactory } from './contact-company-form.factory';
import { ContactUsFormFactory } from './contact-us-form.factory';

@Module({
  imports: [MailsModule],
  providers: [ContactUsFormFactory, ContactCompanyFormFactory],
  exports: [ContactUsFormFactory, ContactCompanyFormFactory],
})
export class ContactsTestingModule {}
