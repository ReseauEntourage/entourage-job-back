import { Module } from '@nestjs/common';
import { SequelizeModule } from '@nestjs/sequelize';
import { MailsModule } from '../mails';
import { UserCandidat, User } from './models';
import { UserCandidatsService } from './user-candidats.service';
import { UsersController } from './users.controller';
import { UsersService } from './users.service';

@Module({
  imports: [SequelizeModule.forFeature([User, UserCandidat]), MailsModule],
  controllers: [UsersController],
  providers: [UsersService, UserCandidatsService],
  exports: [UsersService, UserCandidatsService, SequelizeModule],
})
export class UsersModule {}
