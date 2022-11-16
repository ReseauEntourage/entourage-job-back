import { Module } from '@nestjs/common';
import { PleziModule } from 'src/external-services/plezi/plezi.module';
import { SalesforceModule } from 'src/external-services/salesforce/salesforce.module';
import { MailsModule } from 'src/mails/mails.module';
import { ContactsController } from './contacts.controller';
import { ContactsService } from './contacts.service';

@Module({
  imports: [MailsModule, SalesforceModule, PleziModule],
  controllers: [ContactsController],
  providers: [ContactsService],
  exports: [ContactsService],
})
export class ContactsModule {}
