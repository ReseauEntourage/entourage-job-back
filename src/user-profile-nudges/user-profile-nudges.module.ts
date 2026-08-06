import { Module } from '@nestjs/common';
import { SequelizeModule } from '@nestjs/sequelize';
import { UserProfileNudge } from 'src/user-profiles/models/user-profile-nudge.model';
import { UserProfileNudgesService } from './user-profile-nudges.service';

@Module({
  imports: [SequelizeModule.forFeature([UserProfileNudge])],
  providers: [UserProfileNudgesService],
  exports: [SequelizeModule, UserProfileNudgesService],
})
export class UserProfileNudgesModule {}
