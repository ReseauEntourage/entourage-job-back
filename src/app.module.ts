import { BullModule, BullModuleOptions } from '@nestjs/bull';
import { Module } from '@nestjs/common';

import { ConfigModule } from '@nestjs/config';
import { APP_GUARD } from '@nestjs/core';
import { SequelizeModule } from '@nestjs/sequelize';
import { SequelizeModuleOptions } from '@nestjs/sequelize/dist/interfaces/sequelize-options.interface';
import { ThrottlerGuard, ThrottlerModule } from '@nestjs/throttler';
import { AuthModule } from './auth/auth.module';
import { JwtAuthGuard } from './auth/guards/jwt-auth.gard';
import { UsersModule } from './users/users.module';

const ENV = `${process.env.NODE_ENV}`;

const getParsedURI = (uri: string) => new URL(uri);

export function getBullOptions(uri: string): BullModuleOptions {
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
      envFilePath: ENV === 'dev-test' ? '.env.dev-test' : '.env',
    }),
    SequelizeModule.forRoot(getSequelizeOptions(process.env.DATABASE_URL)),
    ThrottlerModule.forRoot({
      ttl: 60,
      limit: 100,
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
