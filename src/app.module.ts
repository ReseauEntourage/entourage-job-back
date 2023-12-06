import { BullModule } from '@nestjs/bull';
import { CacheModule, Module } from '@nestjs/common';

import { ConfigModule } from '@nestjs/config';
import { APP_GUARD } from '@nestjs/core';
import { SequelizeModule, SequelizeModuleOptions } from '@nestjs/sequelize';
import { ThrottlerGuard, ThrottlerModule } from '@nestjs/throttler';
import * as redisStore from 'cache-manager-redis-store';
import type { ClientOpts } from 'redis';
import { AuthModule } from 'src/auth/auth.module';
import { JwtAuthGuard } from 'src/auth/guards';
import { AmbitionsModule } from 'src/common/ambitions/ambitions.module';
import { BusinessLinesModule } from 'src/common/business-lines/business-lines.module';
import { ContractsModule } from 'src/common/contracts/contracts.module';
import { ExperiencesModule } from 'src/common/experiences/experiences.module';
import { FormationsModule } from 'src/common/formations/formations.module';
import { LanguagesModule } from 'src/common/languages/languages.module';
import { LocationsModule } from 'src/common/locations/locations.module';
import { PassionsModule } from 'src/common/passions/passions.module';
import { ReviewsModule } from 'src/common/reviews/reviews.module';
import { SkillsModule } from 'src/common/skills/skills.module';
import { CVsModule } from 'src/cvs/cvs.module';
import { SharesModule } from 'src/shares/shares.module';
import { UsersCreationModule } from 'src/users-creation/users-creation.module';
import { UsersDeletionModule } from 'src/users-deletion/users-deletion.module';
import { UsersModule } from 'src/users/users.module';
import { ContactsModule } from './contacts/contacts.module';
import { ExternalDatabasesModule } from './external-databases/external-databases.module';
import { ExternalMessagesModule } from './external-messages/external-messages.module';
import { BitlyModule } from './external-services/bitly/bitly.module';
import { MailjetModule } from './external-services/mailjet/mailjet.module';
import { SalesforceModule } from './external-services/salesforce/salesforce.module';
import { MailsModule } from './mails/mails.module';
import { OpportunitiesModule } from './opportunities/opportunities.module';
import { OrganizationsModule } from './organizations/organizations.module';
import { RevisionsModule } from './revisions/revisions.module';
import { SMSModule } from './sms/sms.module';
import { UserProfilesModule } from './user-profiles/user-profiles.module';

const ENV = `${process.env.NODE_ENV}`;

const getParsedURI = (uri: string) => new URL(uri);

export function getRedisOptions() {
  const redisUri = process.env.REDIS_TLS_URL || process.env.REDIS_URL;
  const { port, hostname, password } = getParsedURI(redisUri);
  return {
    port: parseInt(port),
    host: hostname,
    password: password,
    tls: process.env.DEBUG_JOBS
      ? undefined
      : {
          rejectUnauthorized: false,
          requestCert: true,
        },
  };
}

export function getSequelizeOptions(): SequelizeModuleOptions {
  const dbUri = process.env.DATABASE_URL;

  const { hostname, port, username, password, pathname } = getParsedURI(dbUri);

  return {
    dialect: 'postgres',
    host: hostname,
    port: parseInt(port),
    username: username,
    password: password,
    database: pathname.replace('/', ''),
    autoLoadModels: true,
    synchronize: true,
    logging: false,
  };
}

@Module({
  imports: [
    ConfigModule.forRoot({
      isGlobal: true,
      envFilePath: ENV === 'dev-test' || ENV === 'test' ? '.env.test' : '.env',
    }),
    SequelizeModule.forRoot(getSequelizeOptions()),
    ThrottlerModule.forRoot({
      ttl: 60,
      limit: 100,
    }),
    BullModule.forRoot({
      redis: ENV === 'dev-test' || ENV === 'test' ? {} : getRedisOptions(),
    }),
    CacheModule.register<ClientOpts>({
      isGlobal: true,
      store: redisStore,
      ...(ENV === 'dev-test' || ENV === 'test' ? {} : getRedisOptions()),
    }),
    RevisionsModule,
    SharesModule,
    // Put SharesModule before CVsModule
    CVsModule,
    AuthModule,
    UsersModule,
    OpportunitiesModule,
    UsersDeletionModule,
    UsersCreationModule,
    BusinessLinesModule,
    LocationsModule,
    AmbitionsModule,
    ContractsModule,
    LanguagesModule,
    PassionsModule,
    SkillsModule,
    ExperiencesModule,
    FormationsModule,
    ReviewsModule,
    MailsModule,
    MailjetModule,
    ExternalDatabasesModule,
    SalesforceModule,
    SMSModule,
    BitlyModule,
    ContactsModule,
    OrganizationsModule,
    ExternalMessagesModule,
    UserProfilesModule,
  ],
  providers: [
    {
      provide: APP_GUARD,
      useClass: JwtAuthGuard,
    },
    {
      provide: APP_GUARD,
      useClass: ThrottlerGuard,
    },
  ],
  exports: [
    RevisionsModule,
    SharesModule,
    // Put SharesModule before CVsModule
    CVsModule,
    AuthModule,
    UsersModule,
    OpportunitiesModule,
    UsersDeletionModule,
    UsersCreationModule,
    BusinessLinesModule,
    LocationsModule,
    AmbitionsModule,
    ContractsModule,
    LanguagesModule,
    PassionsModule,
    SkillsModule,
    ExperiencesModule,
    FormationsModule,
    ReviewsModule,
    OrganizationsModule,
    ExternalMessagesModule,
  ],
})
export class AppModule {}
