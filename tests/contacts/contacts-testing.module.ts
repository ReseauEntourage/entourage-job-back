import { Module } from '@nestjs/common';
import { MailsModule } from 'src/mails/mails.module';
import { ContactCandidateFormFactory } from './contact-candidate-form.factory';
import { ContactCompanyFormFactory } from './contact-company-form.factory';
import { ContactUsFormFactory } from './contact-us-form.factory';

@Module({
  imports: [MailsModule],
  providers: [
    ContactUsFormFactory,
    ContactCompanyFormFactory,
    ContactCandidateFormFactory,
  ],
  exports: [
    ContactUsFormFactory,
    ContactCompanyFormFactory,
    ContactCandidateFormFactory,
  ],
})
export class ContactsTestingModule {}
