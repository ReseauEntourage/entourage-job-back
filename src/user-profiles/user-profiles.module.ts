import { Module } from '@nestjs/common';
import { SequelizeModule } from '@nestjs/sequelize';
import { BusinessSectorsModule } from 'src/common/business-sectors/business-sectors.module';
import { OccupationsModule } from 'src/common/occupations/occupations.module';
import { AWSModule } from 'src/external-services/aws/aws.module';
import { SlackModule } from 'src/external-services/slack/slack.module';
import { MailsModule } from 'src/mails/mails.module';
import { MessagesModule } from 'src/messages/messages.module';
import { UsersModule } from 'src/users/users.module';
import {
  HelpNeed,
  HelpOffer,
  UserProfile,
  UserProfileSectorOccupation,
} from './models';
import { UserProfileContract } from './models/user-profile-contract.model';
import { UserProfileExperience } from './models/user-profile-experience.model';
import { UserProfileFormation } from './models/user-profile-formation.model';
import { UserProfileLanguage } from './models/user-profile-language.model';
import { UserProfileRecommendation } from './models/user-profile-recommendation.model';
import { UserProfileSkill } from './models/user-profile-skill.model';
import { UserProfilesController } from './user-profiles.controller';
import { UserProfilesService } from './user-profiles.service';

@Module({
  imports: [
    SequelizeModule.forFeature([
      UserProfile,
      UserProfileLanguage,
      UserProfileContract,
      UserProfileSkill,
      UserProfileExperience,
      UserProfileFormation,
      UserProfileSectorOccupation,
      HelpNeed,
      HelpOffer,
      UserProfileRecommendation,
    ]),
    UsersModule,
    OccupationsModule,
    BusinessSectorsModule,
    AWSModule,
    MessagesModule,
    SlackModule,
    MailsModule,
  ],
  controllers: [UserProfilesController],
  providers: [UserProfilesService],
  exports: [SequelizeModule, UserProfilesService],
})
export class UserProfilesModule {}
