import { forwardRef, Module } from '@nestjs/common';
import { SequelizeModule } from '@nestjs/sequelize';
import { BusinessSectorsModule } from 'src/common/business-sectors/business-sectors.module';
import { ContractsModule } from 'src/common/contracts/contracts.module';
import { DepartmentsModule } from 'src/common/departments/departments.module';
import { ExperiencesModule } from 'src/common/experiences/experiences.module';
import { Experience } from 'src/common/experiences/models';
import { FormationsModule } from 'src/common/formations/formations.module';
import { InterestsModule } from 'src/common/interests/interests.module';
import { Interest } from 'src/common/interests/models';
import { LanguagesModule } from 'src/common/languages/languages.module';
import { NudgesModule } from 'src/common/nudge/nudges.module';
import { OccupationsModule } from 'src/common/occupations/occupations.module';
import { ReviewsModule } from 'src/common/reviews/reviews.module';
import { Skill } from 'src/common/skills/models';
import { SkillsModule } from 'src/common/skills/skills.module';
import { CompanyUser } from 'src/companies/models/company-user.model';
import { AWSModule } from 'src/external-services/aws/aws.module';
import { SlackModule } from 'src/external-services/slack/slack.module';
import { VoyageAiModule } from 'src/external-services/voyageai/voyageai.module';
import { MailsModule } from 'src/mails/mails.module';
import { QueuesModule } from 'src/queues/producers';
import { UsersModule } from 'src/users/users.module';
import { UsersStatsModule } from 'src/users-stats/users-stats.module';
import { UserProfile, UserProfileSectorOccupation } from './models';
import { UserProfileContract } from './models/user-profile-contract.model';
import { UserProfileEmbedding } from './models/user-profile-embedding.model';
import { UserProfileFormation } from './models/user-profile-formation.model';
import { UserProfileLanguage } from './models/user-profile-language.model';
import { UserProfileNudge } from './models/user-profile-nudge.model';
import { UserProfileRecommendation } from './models/user-profile-recommendation.model';
import { UserProfileSkill } from './models/user-profile-skill.model';
import { UserProfileRecommendationsService } from './recommendations/user-profile-recommendations-ai.service';
import { UserProfileRecommendationsLegacyService } from './recommendations/user-profile-recommendations-legacy.service';
import { UserProfilesController } from './user-profiles.controller';
import { UserProfilesService } from './user-profiles.service';

@Module({
  imports: [
    SequelizeModule.forFeature([
      UserProfile,
      UserProfileLanguage,
      UserProfileContract,
      UserProfileFormation,
      UserProfileSectorOccupation,
      UserProfileNudge,
      UserProfileRecommendation,
      UserProfileSkill,
      Interest,
      Skill,
      Experience,
      CompanyUser,
      UserProfileEmbedding,
    ]),
    forwardRef(() => UsersModule),
    OccupationsModule,
    BusinessSectorsModule,
    NudgesModule,
    AWSModule,
    SlackModule,
    forwardRef(() => MailsModule),
    ExperiencesModule,
    FormationsModule,
    SkillsModule,
    ContractsModule,
    LanguagesModule,
    ReviewsModule,
    InterestsModule,
    DepartmentsModule,
    UsersStatsModule,
    QueuesModule,
    VoyageAiModule,
  ],
  controllers: [UserProfilesController],
  providers: [
    UserProfilesService,
    UserProfileRecommendationsService,
    UserProfileRecommendationsLegacyService,
  ],
  exports: [
    SequelizeModule,
    UserProfilesService,
    UserProfileRecommendationsService,
    UserProfileRecommendationsLegacyService,
  ],
})
export class UserProfilesModule {}
