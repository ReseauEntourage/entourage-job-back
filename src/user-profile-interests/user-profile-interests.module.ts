import { Module } from '@nestjs/common';
import { SequelizeModule } from '@nestjs/sequelize';
import { Interest } from 'src/interests/models';
import { UserProfileInterestsService } from './user-profile-interests.service';

@Module({
  imports: [SequelizeModule.forFeature([Interest])],
  providers: [UserProfileInterestsService],
  exports: [SequelizeModule, UserProfileInterestsService],
})
export class UserProfileInterestsModule {}
