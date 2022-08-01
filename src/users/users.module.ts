import { Module } from '@nestjs/common';
import { SequelizeModule } from '@nestjs/sequelize';
import { UserCandidat, User } from './models';
import { UserCandidatsService } from './user-candidats.service';
import { UsersController } from './users.controller';
import { UsersService } from './users.service';

@Module({
  imports: [SequelizeModule.forFeature([User, UserCandidat])],
  controllers: [UsersController],
  providers: [UsersService, UserCandidatsService],
  exports: [UsersService, UserCandidatsService, SequelizeModule],
})
export class UsersModule {}
