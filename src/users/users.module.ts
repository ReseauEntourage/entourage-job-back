import { forwardRef, Module } from '@nestjs/common';
import { SequelizeModule } from '@nestjs/sequelize';
import { AuthModule } from '../auth';
import { MailsModule } from '../mails';
import { UserCandidat } from './models/user-candidat.model';
import { User } from './models/user.model';
import { UserCandidatsService } from './user-candidats.service';
import { UsersController } from './users.controller';
import { UsersService } from './users.service';

@Module({
  controllers: [UsersController],
  providers: [UsersService, UserCandidatsService],
  imports: [SequelizeModule.forFeature([User, UserCandidat]), MailsModule],
  exports: [UsersService, UserCandidatsService, SequelizeModule],
})
export class UsersModule {}
