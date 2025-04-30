import { forwardRef, Module } from '@nestjs/common';
import { JwtModule } from '@nestjs/jwt';
import { PassportModule } from '@nestjs/passport';
import { MailsModule } from 'src/mails/mails.module';
import { SessionsModule } from 'src/sessions/sessions.module';
import { SessionsService } from 'src/sessions/sessions.service';
import { UsersModule } from 'src/users/users.module';
import { UsersStatsModule } from 'src/users-stats/users-stats.module';
import { AuthController } from './auth.controller';
import { AuthService } from './auth.service';
import { JwtStrategy, LocalStrategy } from './guards';

@Module({
  imports: [
    PassportModule,
    JwtModule.register({
      secret: `${process.env.JWT_SECRET}`,
      signOptions: { expiresIn: '30d' },
    }),
    MailsModule,
    forwardRef(() => UsersModule),
    forwardRef(() => UsersStatsModule),
    SessionsModule,
  ],
  controllers: [AuthController],
  providers: [AuthService, SessionsService, LocalStrategy, JwtStrategy],
  exports: [AuthService],
})
export class AuthModule {}
