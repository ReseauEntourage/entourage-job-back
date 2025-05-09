import { Module } from '@nestjs/common';

import { AppModule } from 'src/app.module';
import { AuthTestingModule } from './auth/auth-testing.module';
import { AmbitionsTestingModule } from './common/ambitions/ambitions-testing.module';
import { BusinessLinesTestingModule } from './common/business-lines/business-lines-testing.module';
import { ContractsTestingModule } from './common/contracts/contracts-testing.module';
import { ExperiencesTestingModule } from './common/experiences/experiences-testing.module';
import { FormationsTestingModule } from './common/formations/formations-testing.module';
import { LanguagesTestingModule } from './common/languages/languages-testing.module';
import { LocationsTestingModule } from './common/locations/locations-testing.module';
import { PassionsTestingModule } from './common/passions/passions-testing.module';
import { ReviewsTestingModule } from './common/reviews/reviews-testing.module';
import { SharesTestingModule } from './common/shares/shares-testing.module';
import { SkillsTestingModule } from './common/skills/skills-testing.module';
import { ContactsTestingModule } from './contacts/contacts-testing.module';
import { CVsTestingModule } from './cvs/cvs-testing.module';
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
    BusinessLinesTestingModule,
    CVsTestingModule,
    LocationsTestingModule,
    AmbitionsTestingModule,
    ContractsTestingModule,
    ExperiencesTestingModule,
    FormationsTestingModule,
    LanguagesTestingModule,
    LocationsTestingModule,
    PassionsTestingModule,
    SkillsTestingModule,
    UsersTestingModule,
    ReviewsTestingModule,
    SharesTestingModule,
    ContactsTestingModule,
    OrganizationsTestingModule,
    MessagesTestingModule,
    ExternalCvsTestingModule,
    MessagingTestingModule,
  ],
  providers: [DatabaseHelper],
})
export class CustomTestingModule {}
