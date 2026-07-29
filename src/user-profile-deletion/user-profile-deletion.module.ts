import { Module } from '@nestjs/common';
import { SequelizeModule } from '@nestjs/sequelize';
import { UserProfile } from 'src/user-profiles/models';
import { UserProfileDeletionService } from './user-profile-deletion.service';

@Module({
  imports: [SequelizeModule.forFeature([UserProfile])],
  providers: [UserProfileDeletionService],
  exports: [SequelizeModule, UserProfileDeletionService],
})
export class UserProfileDeletionModule {}
