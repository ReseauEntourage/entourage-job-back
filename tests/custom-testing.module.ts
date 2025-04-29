import { Module } from '@nestjs/common';

import { AppModule } from 'src/app.module';
import { AuthTestingModule } from './auth/auth-testing.module';
import { ContactsTestingModule } from './contacts/contacts-testing.module';
import { DatabaseHelper } from './database.helper';
import { ExternalCvsTestingModule } from './external-cvs/external-cvs-testing.module';
import { MessagesTestingModule } from './messages/messages-testing.module';
import { MessagingTestingModule } from './messaging/messaging-testing.module';
import { OrganizationsTestingModule } from './organizations/organizations-testing.module';
import { UsersTestingModule } from './users/users-testing.module';

@Module({
  imports: [
    AppModule,
    AuthTestingModule,
    UsersTestingModule,
    ContactsTestingModule,
    OrganizationsTestingModule,
    MessagesTestingModule,
    ExternalCvsTestingModule,
    MessagingTestingModule,
  ],
  providers: [DatabaseHelper],
})
export class CustomTestingModule {}
