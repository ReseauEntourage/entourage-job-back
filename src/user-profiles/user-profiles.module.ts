import { forwardRef, Module } from '@nestjs/common';
import { SequelizeModule } from '@nestjs/sequelize';
import { DepartmentsModule } from 'src/common/departments/departments.module';
import { ReviewsModule } from 'src/common/reviews/reviews.module';
import { CompanyUser } from 'src/companies/models/company-user.model';
import { SlackModule } from 'src/external-services/slack/slack.module';
import { MailsModule } from 'src/mails/mails.module';
import { QueuesModule } from 'src/queues/producers';
import { UserProfileAnalyticsModule } from 'src/user-profile-analytics/user-profile-analytics.module';
import { UserProfileContractsModule } from 'src/user-profile-contracts/user-profile-contracts.module';
import { UserProfileDeletionModule } from 'src/user-profile-deletion/user-profile-deletion.module';
import { UserProfileEmbeddingsModule } from 'src/user-profile-embeddings/user-profile-embeddings.module';
import { UserProfileExperiencesModule } from 'src/user-profile-experiences/user-profile-experiences.module';
import { UserProfileFormationsModule } from 'src/user-profile-formations/user-profile-formations.module';
import { UserProfileInterestsModule } from 'src/user-profile-interests/user-profile-interests.module';
import { UserProfileLanguagesModule } from 'src/user-profile-languages/user-profile-languages.module';
import { UserProfileMediaModule } from 'src/user-profile-media/user-profile-media.module';
import { UserProfileModerationModule } from 'src/user-profile-moderation/user-profile-moderation.module';
import { UserProfileNudgesModule } from 'src/user-profile-nudges/user-profile-nudges.module';
import { UserProfileRecommendationsModule } from 'src/user-profile-recommendations/user-profile-recommendations.module';
import { UserProfileSectorOccupationsModule } from 'src/user-profile-sector-occupations/user-profile-sector-occupations.module';
import { UserProfileSkillsModule } from 'src/user-profile-skills/user-profile-skills.module';
import { UsersModule } from 'src/users/users.module';
import { UsersStatsModule } from 'src/users-stats/users-stats.module';
import { UserProfile, UserProfileSectorOccupation } from './models';
import { UserProfilesController } from './user-profiles.controller';
import { UserProfilesService } from './user-profiles.service';

@Module({
  imports: [
    SequelizeModule.forFeature([
      UserProfile,
      UserProfileSectorOccupation,
      CompanyUser,
    ]),
    forwardRef(() => UsersModule),
    SlackModule,
    forwardRef(() => MailsModule),
    ReviewsModule,
    DepartmentsModule,
    forwardRef(() => UsersStatsModule),
    QueuesModule,
    forwardRef(() => UserProfileMediaModule),
    UserProfileDeletionModule,
    UserProfileEmbeddingsModule,
    UserProfileAnalyticsModule,
    UserProfileLanguagesModule,
    UserProfileSkillsModule,
    UserProfileExperiencesModule,
    UserProfileFormationsModule,
    UserProfileNudgesModule,
    UserProfileContractsModule,
    UserProfileInterestsModule,
    UserProfileSectorOccupationsModule,
    UserProfileModerationModule,
    forwardRef(() => UserProfileRecommendationsModule),
  ],
  controllers: [UserProfilesController],
  providers: [UserProfilesService],
  exports: [
    SequelizeModule,
    UserProfilesService,
    UserProfileDeletionModule,
    UserProfileEmbeddingsModule,
    UserProfileAnalyticsModule,
    UserProfileLanguagesModule,
    UserProfileSkillsModule,
    UserProfileExperiencesModule,
    UserProfileFormationsModule,
    UserProfileNudgesModule,
    UserProfileContractsModule,
    UserProfileInterestsModule,
    UserProfileSectorOccupationsModule,
    UserProfileRecommendationsModule,
  ],
})
export class UserProfilesModule {}
