import { Module } from '@nestjs/common';
import { SequelizeModule } from '@nestjs/sequelize';
import { UserProfileAnalyticsModule } from 'src/user-profile-analytics/user-profile-analytics.module';
import { UserProfile } from 'src/user-profiles/models';
import { UserProfilesModule } from 'src/user-profiles/user-profiles.module';
import { UsersModule } from 'src/users/users.module';
import { PublicCVsController } from './public-cvs.controller';
import { PublicCVsService } from './public-cvs.services';

@Module({
  imports: [
    SequelizeModule.forFeature([UserProfile]),
    UsersModule,
    UserProfilesModule,
    UserProfileAnalyticsModule,
  ],
  controllers: [PublicCVsController],
  providers: [PublicCVsService],
  exports: [SequelizeModule, PublicCVsService],
})
export class PublicCVsModule {}
