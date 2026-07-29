import { forwardRef, Module } from '@nestjs/common';
import { SequelizeModule } from '@nestjs/sequelize';
import { UserProfile } from 'src/user-profiles/models';
import { UsersStatsModule } from 'src/users-stats/users-stats.module';
import { UserProfileAnalyticsService } from './user-profile-analytics.service';

@Module({
  imports: [
    SequelizeModule.forFeature([UserProfile]),
    forwardRef(() => UsersStatsModule),
  ],
  providers: [UserProfileAnalyticsService],
  exports: [SequelizeModule, UserProfileAnalyticsService],
})
export class UserProfileAnalyticsModule {}
