import { Module } from '@nestjs/common';
import { ConfigModule } from '@nestjs/config';
import { APP_GUARD, APP_INTERCEPTOR } from '@nestjs/core';
import { SequelizeModule } from '@nestjs/sequelize';
import { ThrottlerGuard, ThrottlerModule } from '@nestjs/throttler';

import { getSequelizeOptions } from 'src/app.module';
import { AuthModule } from 'src/auth/auth.module';
import { JwtAuthGuard } from 'src/auth/guards';
import { BusinessSectorsModule } from 'src/business-sectors/business-sectors.module';
import { TimeoutInterceptor } from 'src/common/interceptors';
import { ReviewsModule } from 'src/common/reviews/reviews.module';
import { CompaniesModule } from 'src/companies/companies.module';
import { ContactsModule } from 'src/contacts/contacts.module';
import { ContractsModule } from 'src/contracts/contracts.module';
import { CurrentUserModule } from 'src/current-user/current-user.module';
import { ElearningModule } from 'src/elearning/elearning.module';
import { ExternalCvsModule } from 'src/external-cvs/external-cvs.module';
import { LanguagesModule } from 'src/languages/languages.module';
import { MessagingModule } from 'src/messaging/messaging.module';
import { OrganizationsModule } from 'src/organizations/organizations.module';
import { PassionsModule } from 'src/passions/passions.module';
import { ProfileGenerationModule } from 'src/profile-generation/profile-generation.module';
import { ReadDocumentsModule } from 'src/read-documents/read-documents.module';
import { RecruitementAlertsModule } from 'src/recruitement-alerts/recruitement-alerts.module';
import { RedisModule } from 'src/redis/redis.module';
import { RevisionsModule } from 'src/revisions/revisions.module';
import { SkillsModule } from 'src/skills/skills.module';
import { UserProfilesModule } from 'src/user-profiles/user-profiles.module';
import { UserSocialSituationsModule } from 'src/user-social-situations/user-social-situations.module';
import { UsersModule } from 'src/users/users.module';
import { UsersCreationModule } from 'src/users-creation/users-creation.module';
import { UsersDeletionModule } from 'src/users-deletion/users-deletion.module';
import { AuthTestingModule } from './auth/auth-testing.module';
import { BusinessSectorsTestingModule } from './business-sectors/business-sectors-testing.module';
import { CompaniesTestingModule } from './companies/companies-testing.module';
import { ContactsTestingModule } from './contacts/contacts-testing.module';
import { ContractsTestingModule } from './contracts/contracts-testing.module';
import { DatabaseHelper } from './database.helper';
import { ElearningTestingModule } from './elearning/elearning-testing.module';
import { ExternalCvsTestingModule } from './external-cvs/external-cvs-testing.module';
import { LanguagesTestingModule } from './languages/languages-testing.module';
import { MessagingTestingModule } from './messaging/messaging-testing.module';
import { NudgesTestingModule } from './nudges/nudges-testing.module';
import { OrganizationsTestingModule } from './organizations/organizations-testing.module';
import { PublicCVsTestingModule } from './public-cvs/public-cvs-testing.module';
import { QueuesTestingModule } from './queues/queues-testing.module';
import { RecruitementAlertsTestingModule } from './recruitement-alerts/recruitement-alerts-testing.module';
import { UserCreationTestingModule } from './user-creation/user-creation-testing.module';
import { UserDeletionTestingModule } from './user-deletion/user-deletion-testing.module';
import { UserProfilesTestingModule } from './user-profiles/user-profiles-testing.module';
import { UsersTestingModule } from './users/users-testing.module';

@Module({
  imports: [
    // Configuration de base
    ConfigModule.forRoot({
      isGlobal: true,
      envFilePath: '.env.test',
    }),
    RedisModule,
    SequelizeModule.forRoot(getSequelizeOptions()),
    ThrottlerModule.forRoot([
      {
        ttl: 60000,
        limit: 100,
      },
    ]),
    // Note: BullModule n'est pas configuré pour les tests car QueuesTestingModule
    // mocke directement le QueuesService, évitant ainsi le besoin d'une vraie connexion Redis

    // Modules de base nécessaires pour les tests
    RevisionsModule,
    UserProfilesModule,
    UsersModule,
    UserSocialSituationsModule,
    AuthModule,
    CurrentUserModule,
    ProfileGenerationModule,
    BusinessSectorsModule,
    ContractsModule,
    LanguagesModule,
    PassionsModule,
    SkillsModule,
    ReviewsModule,
    ContactsModule,
    OrganizationsModule,
    MessagingModule,
    ReadDocumentsModule,
    UsersCreationModule,
    UsersDeletionModule,
    CompaniesModule,
    ExternalCvsModule,
    ElearningModule,
    RecruitementAlertsModule,

    // Modules de test spécifiques
    AuthTestingModule,
    UsersTestingModule,
    OrganizationsTestingModule,
    ExternalCvsTestingModule,
    BusinessSectorsTestingModule,
    NudgesTestingModule,
    LanguagesTestingModule,
    ContractsTestingModule,
    PublicCVsTestingModule,
    UserCreationTestingModule,
    UserDeletionTestingModule,
    UserProfilesTestingModule,
    ContactsTestingModule,
    MessagingTestingModule,
    QueuesTestingModule,
    CompaniesTestingModule,
    ElearningTestingModule,
    RecruitementAlertsTestingModule,
  ],
  providers: [
    // Configuration du garde d'authentification global
    {
      provide: APP_GUARD,
      useClass: JwtAuthGuard,
    },
    {
      provide: APP_GUARD,
      useClass: ThrottlerGuard,
    },
    {
      provide: APP_INTERCEPTOR,
      useClass: TimeoutInterceptor,
    },
    DatabaseHelper,
  ],
  exports: [DatabaseHelper],
})
export class CustomTestingModule {}
