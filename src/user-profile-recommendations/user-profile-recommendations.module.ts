import { forwardRef, Module } from '@nestjs/common';
import { SequelizeModule } from '@nestjs/sequelize';
import { UserProfileSectorOccupation } from 'src/user-profiles/models';
import { UserProfileRecommendation } from 'src/user-profiles/models/user-profile-recommendation.model';
import { UserProfilesModule } from 'src/user-profiles/user-profiles.module';
import { UserProfileRecommendationsService } from './user-profile-recommendations-ai.service';
import { UserProfileRecommendationsLegacyService } from './user-profile-recommendations-legacy.service';

@Module({
  imports: [
    SequelizeModule.forFeature([
      UserProfileRecommendation,
      UserProfileSectorOccupation,
    ]),
    forwardRef(() => UserProfilesModule),
  ],
  providers: [
    UserProfileRecommendationsService,
    UserProfileRecommendationsLegacyService,
  ],
  exports: [
    SequelizeModule,
    UserProfileRecommendationsService,
    UserProfileRecommendationsLegacyService,
  ],
})
export class UserProfileRecommendationsModule {}
