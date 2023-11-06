import { Module } from '@nestjs/common';
import { SalesforceModule } from 'src/external-services/salesforce/salesforce.module';
import { MailsModule } from 'src/mails/mails.module';
import { QueuesModule } from 'src/queues/producers';
import { ContactsController } from './contacts.controller';
import { ContactsService } from './contacts.service';

@Module({
  imports: [MailsModule, SalesforceModule, QueuesModule],
  controllers: [ContactsController],
  providers: [ContactsService],
  exports: [ContactsService],
})
export class ContactsModule {}
