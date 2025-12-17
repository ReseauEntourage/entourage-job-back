import { BullModule } from '@nestjs/bull';
import { CacheModule, Module } from '@nestjs/common';
import { ConfigModule } from '@nestjs/config';
import { APP_GUARD, APP_INTERCEPTOR } from '@nestjs/core';
import { SequelizeModuleOptions, SequelizeModule } from '@nestjs/sequelize';
import { ThrottlerModule, ThrottlerGuard } from '@nestjs/throttler';
import * as ioRedisStore from 'cache-manager-ioredis';
import { RedisOptions } from 'ioredis';
import { AuthModule } from './auth/auth.module';
import { JwtAuthGuard } from './auth/guards';
import { BusinessSectorsModule } from './common/business-sectors/business-sectors.module';
import { ContractsModule } from './common/contracts/contracts.module';
import { ExperiencesModule } from './common/experiences/experiences.module';
import { FormationsModule } from './common/formations/formations.module';
import { TimeoutInterceptor } from './common/interceptors';
import { InterestsModule } from './common/interests/interests.module';
import { LanguagesModule } from './common/languages/languages.module';
import { LocationsModule } from './common/locations/locations.module';
import { PassionsModule } from './common/passions/passions.module';
import { RecruitementAlertsModule } from './common/recruitement-alerts/recruitement-alerts.module';
import { ReviewsModule } from './common/reviews/reviews.module';
import { SkillsModule } from './common/skills/skills.module';
import { CompaniesModule } from './companies/companies.module';
import { ContactsModule } from './contacts/contacts.module';
import { EventsModule } from './events/events.module';
import { ExternalCvsModule } from './external-cvs/external-cvs.module';
import { ExternalDatabasesModule } from './external-databases/external-databases.module';
import { OpenAiModule } from './external-services/openai/openai.module';
import { SalesforceModule } from './external-services/salesforce/salesforce.module';
import { MailsModule } from './mails/mails.module';
import { MediasModule } from './medias/medias.module';
import { MessagingModule } from './messaging/messaging.module';
import { OrganizationsModule } from './organizations/organizations.module';
import { PingModule } from './ping/ping.module';
import { ProfileGenerationModule } from './profile-generation/profile-generation.module';
import { PublicCVsModule } from './public-cv/public-cvs.module';
import { QueuesBoardModule } from './queues/producers/queues-board.module';
import { ReadDocumentsModule } from './read-documents/read-documents.module';
import { RedisModule, REDIS_OPTIONS } from './redis/redis.module';
import { RevisionsModule } from './revisions/revisions.module';
import { UserProfilesModule } from './user-profiles/user-profiles.module';
import { UserSocialSituationsModule } from './user-social-situations/user-social-situations.module';
import { UsersModule } from './users/users.module';
import { UsersCreationModule } from './users-creation/users-creation.module';
import { UsersDeletionModule } from './users-deletion/users-deletion.module';
import { UsersStatsModule } from './users-stats/users-stats.module';
import { WorkerControllerModule } from './worker/worker-controller.module';

const ENV = `${process.env.NODE_ENV}`;

const getParsedURI = (uri: string) => new URL(uri);

export function getRedisOptions(): Partial<RedisOptions> {
  if (ENV === 'dev-test' || ENV === 'test') {
    return {};
  }
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
    // synchronize: true,
    logging: false,
  };
}

@Module({
  imports: [
    ConfigModule.forRoot({
      isGlobal: true,
      envFilePath: ENV === 'dev-test' || ENV === 'test' ? '.env.test' : '.env',
    }),
    RedisModule, // Module Redis partagé ajouté avant les modules qui utilisent Redis
    SequelizeModule.forRoot(getSequelizeOptions()),
    ThrottlerModule.forRoot({
      ttl: 60,
      limit: 100,
    }),
    BullModule.forRootAsync({
      imports: [RedisModule],
      inject: [REDIS_OPTIONS],
      useFactory: (redisOptions) => ({
        redis: redisOptions,
      }),
    }),
    ...(process.env.QUEUES_ADMIN_PASSWORD ? [QueuesBoardModule] : []),
    CacheModule.register<RedisOptions>({
      isGlobal: true,
      store: ioRedisStore,
      ...(ENV === 'dev-test' || ENV === 'test' ? {} : getRedisOptions()),
      // Configuration avec cache-manager-ioredis qui est compatible avec ioredis
    }),
    RevisionsModule,
    UserProfilesModule,
    // Put UserProfilesModule before UsersModule
    UsersModule,
    UsersDeletionModule,
    UsersCreationModule,
    UsersStatsModule,
    AuthModule,
    ExternalCvsModule,
    BusinessSectorsModule,
    LocationsModule,
    ContractsModule,
    LanguagesModule,
    InterestsModule,
    PassionsModule,
    SkillsModule,
    ExperiencesModule,
    FormationsModule,
    ReviewsModule,
    RecruitementAlertsModule,
    MailsModule,
    ExternalDatabasesModule,
    SalesforceModule,
    ContactsModule,
    OrganizationsModule,
    ReadDocumentsModule,
    MessagingModule,
    UserSocialSituationsModule,
    MediasModule,
    OpenAiModule,
    PublicCVsModule,
    CompaniesModule,
    ProfileGenerationModule,
    WorkerControllerModule,
    PingModule,
    EventsModule,
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
    {
      provide: APP_INTERCEPTOR,
      useClass: TimeoutInterceptor,
    },
  ],
  exports: [
    RevisionsModule,
    UserProfilesModule,
    // Put UserProfilesModule before UsersModule
    UsersModule,
    UsersDeletionModule,
    UsersCreationModule,
    UsersStatsModule,
    AuthModule,
    BusinessSectorsModule,
    LocationsModule,
    ContractsModule,
    LanguagesModule,
    PassionsModule,
    SkillsModule,
    ExperiencesModule,
    FormationsModule,
    ReviewsModule,
    MailsModule,
    ExternalDatabasesModule,
    SalesforceModule,
    ContactsModule,
    OrganizationsModule,
    MessagingModule,
    MediasModule,
    UserSocialSituationsModule,
  ],
})
export class AppModule {}
