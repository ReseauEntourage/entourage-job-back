import { Module } from '@nestjs/common';

import { SequelizeModule } from '@nestjs/sequelize';

import { AuthModule } from './auth/auth.module';
import { UsersModule } from './users/users.module';
import { ConfigModule } from '@nestjs/config';
import { APP_GUARD } from '@nestjs/core';
import { JwtAuthGuard } from './auth/jwt-auth.gard';
import { ThrottlerGuard, ThrottlerModule } from '@nestjs/throttler';
import { BullModule, BullModuleOptions } from '@nestjs/bull';
import { MailsModule } from './mails/mails.module';
import { SequelizeModuleOptions } from '@nestjs/sequelize/dist/interfaces/sequelize-options.interface';
import { Queues } from './queues/queues.type';
import { QueuesModule } from './queues/producers/queues.module';

const ENV = `${process.env.NODE_ENV}`;

const getParsedURI = (uri) => new URL(uri);

export function getBullOptions(uri): BullModuleOptions {
  const { port, hostname, password } = getParsedURI(uri);
  return {
    redis: {
      port: parseInt(port),
      host: hostname,
      password: password,
      tls: {
        rejectUnauthorized: false,
        requestCert: true,
      },
    },
  };
}

export function getSequelizeOptions(uri): SequelizeModuleOptions {
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
      envFilePath: ENV === 'dev-test' ? '.env.dev-test' : '.env',
    }),
    SequelizeModule.forRoot(getSequelizeOptions(process.env.DATABASE_URL)),
    ThrottlerModule.forRoot({
      ttl: 60,
      limit: 10,
    }),
    BullModule.forRoot(getBullOptions(process.env.REDIS_TLS_URL)),
    AuthModule,
    UsersModule,
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
  exports: [AuthModule, UsersModule],
})
export class AppModule {}
