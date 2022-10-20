import { Module } from '@nestjs/common';
import { AuthModule } from 'src/auth/auth.module';
import { MailsModule } from 'src/mails/mails.module';
import { UsersModule } from 'src/users/users.module';
import { UsersCreationController } from './users-creation.controller';
import { UsersCreationService } from './users-creation.service';

@Module({
  imports: [MailsModule, UsersModule, AuthModule],
  controllers: [UsersCreationController],
  providers: [UsersCreationService],
})
export class UsersCreationModule {}
