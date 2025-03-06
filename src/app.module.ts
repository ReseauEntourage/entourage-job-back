import { BullModule } from '@nestjs/bull';
import { Module, CacheModule } from '@nestjs/common';
import { ConfigModule } from '@nestjs/config';
import { APP_GUARD } from '@nestjs/core';
import { SequelizeModuleOptions, SequelizeModule } from '@nestjs/sequelize';
import { ThrottlerModule, ThrottlerGuard } from '@nestjs/throttler';
import * as redisStore from 'cache-manager-redis-store';
import { ClientOpts } from 'redis';
import { AuthModule } from './auth/auth.module';
import { JwtAuthGuard } from './auth/guards';
import { AmbitionsModule } from './common/ambitions/ambitions.module';
import { BusinessLinesModule } from './common/business-lines/business-lines.module';
import { ContractsModule } from './common/contracts/contracts.module';
import { ExperiencesModule } from './common/experiences/experiences.module';
import { FormationsModule } from './common/formations/formations.module';
import { LanguagesModule } from './common/languages/languages.module';
import { LocationsModule } from './common/locations/locations.module';
import { PassionsModule } from './common/passions/passions.module';
import { ReviewsModule } from './common/reviews/reviews.module';
import { SkillsModule } from './common/skills/skills.module';
import { ContactsModule } from './contacts/contacts.module';
import { CVsModule } from './cvs/cvs.module';
import { ExternalCvsModule } from './external-cvs/external-cvs.module';
import { ExternalDatabasesModule } from './external-databases/external-databases.module';
import { BitlyModule } from './external-services/bitly/bitly.module';
import { MailjetModule } from './external-services/mailjet/mailjet.module';
import { SalesforceModule } from './external-services/salesforce/salesforce.module';
import { MailsModule } from './mails/mails.module';
import { MessagesModule } from './messages/messages.module';
import { MessagingModule } from './messaging/messaging.module';
import { OpportunitiesModule } from './opportunities/opportunities.module';
import { OrganizationsModule } from './organizations/organizations.module';
import { ReadDocumentsModule } from './read-documents/read-documents.module';
import { RevisionsModule } from './revisions/revisions.module';
import { SharesModule } from './shares/shares.module';
import { SMSModule } from './sms/sms.module';
import { UserProfilesModule } from './user-profiles/user-profiles.module';
import { UserSocialSituationsModule } from './user-social-situations/user-social-situations.module';
import { UsersModule } from './users/users.module';
import { UsersCreationModule } from './users-creation/users-creation.module';
import { UsersDeletionModule } from './users-deletion/users-deletion.module';

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
    logging: true,
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
    UserProfilesModule,
    // Put UserProfilesModule before UsersModule
    SharesModule,
    // Put SharesModule before CVsModule
    UsersModule,
    UsersDeletionModule,
    UsersCreationModule,
    AuthModule,
    CVsModule,
    ExternalCvsModule,
    OpportunitiesModule,
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
    MessagesModule,
    ReadDocumentsModule,
    MessagingModule,
    UserSocialSituationsModule,
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
    UserProfilesModule,
    // Put UserProfilesModule before UsersModule
    SharesModule,
    // Put SharesModule before CVsModule
    UsersModule,
    UsersDeletionModule,
    UsersCreationModule,
    AuthModule,
    CVsModule,
    OpportunitiesModule,
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
    MessagesModule,
    MessagingModule,
    UserSocialSituationsModule,
  ],
})
export class AppModule {}
