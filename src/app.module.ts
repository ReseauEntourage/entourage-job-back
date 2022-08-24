import { BullModule } from '@nestjs/bull';
import { CacheModule, Module } from '@nestjs/common';

import { ConfigModule } from '@nestjs/config';
import { APP_GUARD } from '@nestjs/core';
import { SequelizeModule, SequelizeModuleOptions } from '@nestjs/sequelize';
import { ThrottlerGuard, ThrottlerModule } from '@nestjs/throttler';
import * as redisStore from 'cache-manager-redis-store';
import type { ClientOpts } from 'redis';
import { AmbitionsModule } from 'src/ambitions/ambitions.module';
import { AuthModule } from 'src/auth/auth.module';
import { JwtAuthGuard } from 'src/auth/guards';
import { BusinessLinesModule } from 'src/businessLines/businessLines.module';
import { ContractsModule } from 'src/contracts/contracts.module';
import { CVsModule } from 'src/cvs/cvs.module';
import { ExperiencesModule } from 'src/experiences/experiences.module';
import { LanguagesModule } from 'src/languages/languages.module';
import { LocationsModule } from 'src/locations/locations.module';
import { PassionsModule } from 'src/passions/passions.module';
import { ReviewsModule } from 'src/reviews/reviews.module';
import { SharesModule } from 'src/shares/shares.module';
import { SkillsModule } from 'src/skills/skills.module';
import { UsersCreationModule } from 'src/users-creation/users-creation.module';
import { UsersDeletionModule } from 'src/users-deletion/users-deletion.module';
import { UsersModule } from 'src/users/users.module';

const ENV = `${process.env.NODE_ENV}`;

const getParsedURI = (uri: string) => new URL(uri);

export function getRedisOptions(uri: string) {
  const { port, hostname, password } = getParsedURI(uri);
  return {
    port: parseInt(port),
    host: hostname,
    password: password,
    tls: {
      rejectUnauthorized: false,
      requestCert: true,
    },
  };
}

export function getSequelizeOptions(uri: string): SequelizeModuleOptions {
  const { hostname, port, username, password, pathname } = getParsedURI(uri);

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
      envFilePath: ENV === 'dev-test' ? '.env.test' : '.env',
    }),
    SequelizeModule.forRoot(getSequelizeOptions(process.env.DATABASE_URL)),
    ThrottlerModule.forRoot({
      ttl: 60,
      limit: 100,
    }),
    BullModule.forRoot({ redis: getRedisOptions(process.env.REDIS_TLS_URL) }),
    CacheModule.register<ClientOpts>({
      isGlobal: true,
      store: redisStore,
      ...getRedisOptions(process.env.REDIS_TLS_URL),
    }),
    SharesModule,
    // Put SharesModule before CVsModule
    CVsModule,
    AuthModule,
    UsersModule,
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
    ReviewsModule,
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
    SharesModule,
    // Put SharesModule before CVsModule
    CVsModule,
    AuthModule,
    UsersModule,
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
    ReviewsModule,
  ],
})
export class AppModule {}
