import { Module } from '@nestjs/common';
import { SequelizeModule } from '@nestjs/sequelize';
import { UserProfileShare } from './models/user-profile-share.model';
import { UserProfileSharesController } from './user-profile-shares.controller';
import { UserProfileSharesService } from './user-profile-shares.service';

@Module({
  imports: [SequelizeModule.forFeature([UserProfileShare])],
  controllers: [UserProfileSharesController],
  providers: [UserProfileSharesService],
  exports: [UserProfileSharesService],
})
export class UserProfileSharesModule {}
