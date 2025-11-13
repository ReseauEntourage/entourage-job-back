import { BullModule } from '@nestjs/bull';
import { CacheModule, Module } from '@nestjs/common';
import { ConfigModule } from '@nestjs/config';
import { APP_GUARD, APP_INTERCEPTOR } from '@nestjs/core';
import { SequelizeModule } from '@nestjs/sequelize';
import { ThrottlerGuard, ThrottlerModule } from '@nestjs/throttler';

import { getSequelizeOptions } from 'src/app.module';
import { AuthModule } from 'src/auth/auth.module';
import { JwtAuthGuard } from 'src/auth/guards';
import { BusinessSectorsModule } from 'src/common/business-sectors/business-sectors.module';
import { ContractsModule } from 'src/common/contracts/contracts.module';
import { ExperiencesModule } from 'src/common/experiences/experiences.module';
import { FormationsModule } from 'src/common/formations/formations.module';
import { TimeoutInterceptor } from 'src/common/interceptors';
import { InterestsModule } from 'src/common/interests/interests.module';
import { LanguagesModule } from 'src/common/languages/languages.module';
import { PassionsModule } from 'src/common/passions/passions.module';
import { ReviewsModule } from 'src/common/reviews/reviews.module';
import { SkillsModule } from 'src/common/skills/skills.module';
import { CompaniesModule } from 'src/companies/companies.module';
import { ContactsModule } from 'src/contacts/contacts.module';
import { ExternalCvsModule } from 'src/external-cvs/external-cvs.module';
import { MessagingModule } from 'src/messaging/messaging.module';
import { OrganizationsModule } from 'src/organizations/organizations.module';
import { ReadDocumentsModule } from 'src/read-documents/read-documents.module';
import { RedisModule } from 'src/redis/redis.module';
import { RevisionsModule } from 'src/revisions/revisions.module';
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
import { ExternalCvsTestingModule } from './external-cvs/external-cvs-testing.module';
import { LanguagesTestingModule } from './languages/languages-testing.module';
import { MessagingTestingModule } from './messaging/messaging-testing.module';
import { NudgesTestingModule } from './nudges/nudges-testing.module';
import { OrganizationsTestingModule } from './organizations/organizations-testing.module';
import { PublicCVsTestingModule } from './public-cvs/public-cvs-testing.module';
import { QueuesTestingModule } from './queues/queues-testing.module';
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
    ThrottlerModule.forRoot({
      ttl: 60,
      limit: 100,
    }),
    BullModule.forRoot({
      // Configuration pour les tests
      redis: {}, // Sera remplacé par notre mock
    }),
    CacheModule.register({
      isGlobal: true,
    }),

    // Modules de base nécessaires pour les tests
    RevisionsModule,
    UserProfilesModule,
    UsersModule,
    UserSocialSituationsModule,
    AuthModule,
    BusinessSectorsModule,
    ContractsModule,
    LanguagesModule,
    InterestsModule,
    PassionsModule,
    SkillsModule,
    ExperiencesModule,
    FormationsModule,
    ReviewsModule,
    ContactsModule,
    OrganizationsModule,
    MessagingModule,
    ReadDocumentsModule,
    UsersCreationModule,
    UsersDeletionModule,
    CompaniesModule,
    ExternalCvsModule,

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
