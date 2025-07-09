import { Module } from '@nestjs/common';

import { AppModule } from 'src/app.module';
import { AuthTestingModule } from './auth/auth-testing.module';
import { BusinessSectorsTestingModule } from './business-sectors/business-sectors-testing.module';
import { ContactsTestingModule } from './contacts/contacts-testing.module';
import { ContractsTestingModule } from './contracts/contracts-testing.module';
import { DatabaseHelper } from './database.helper';
import { ExternalCvsTestingModule } from './external-cvs/external-cvs-testing.module';
import { LanguagesTestingModule } from './languages/languages-testing.module';
import { MessagingTestingModule } from './messaging/messaging-testing.module';
import { NudgesTestingModule } from './nudges/nudges-testing.module';
import { OrganizationsTestingModule } from './organizations/organizations-testing.module';
import { PublicProfilesTestingModule } from './public-profiles/public-profiles-testing.module';
import { UserCreationTestingModule } from './user-creation/user-creation-testing.module';
import { UserDeletionTestingModule } from './user-deletion/user-deletion-testing.module';
import { UserProfilesTestingModule } from './user-profiles/user-profiles-testing.module';
import { UsersTestingModule } from './users/users-testing.module';

@Module({
  imports: [
    AppModule,
    AuthTestingModule,
    UsersTestingModule,
    OrganizationsTestingModule,
    ExternalCvsTestingModule,
    BusinessSectorsTestingModule,
    NudgesTestingModule,
    LanguagesTestingModule,
    ContractsTestingModule,
    PublicProfilesTestingModule,
    UserCreationTestingModule,
    UserDeletionTestingModule,
    UserProfilesTestingModule,
    ContactsTestingModule,
    MessagingTestingModule,
  ],
  providers: [DatabaseHelper],
  exports: [DatabaseHelper],
})
export class CustomTestingModule {}
