import { Module } from '@nestjs/common';
import { SequelizeModule } from '@nestjs/sequelize';
import { BusinessSectorsModule } from 'src/common/business-sectors/business-sectors.module';
import { Interest } from 'src/common/interests/models';
import { NudgesModule } from 'src/common/nudge/nudges.module';
import { OccupationsModule } from 'src/common/occupations/occupations.module';
import { Skill } from 'src/common/skills/models';
import { AWSModule } from 'src/external-services/aws/aws.module';
import { SlackModule } from 'src/external-services/slack/slack.module';
import { MailsModule } from 'src/mails/mails.module';
import { MessagesModule } from 'src/messages/messages.module';
import { MessagingModule } from 'src/messaging/messaging.module';
import { UsersModule } from 'src/users/users.module';
import { UserProfile, UserProfileSectorOccupation } from './models';
import { UserProfileContract } from './models/user-profile-contract.model';
import { UserProfileExperience } from './models/user-profile-experience.model';
import { UserProfileFormation } from './models/user-profile-formation.model';
import { UserProfileLanguage } from './models/user-profile-language.model';
import { UserProfileNudge } from './models/user-profile-nudge.model';
import { UserProfileRecommendation } from './models/user-profile-recommendation.model';
import { UserProfilesController } from './user-profiles.controller';
import { UserProfilesService } from './user-profiles.service';

@Module({
  imports: [
    SequelizeModule.forFeature([
      UserProfile,
      UserProfileLanguage,
      UserProfileContract,
      UserProfileExperience,
      UserProfileFormation,
      UserProfileSectorOccupation,
      UserProfileNudge,
      UserProfileRecommendation,
      Interest,
      Skill,
    ]),
    UsersModule,
    OccupationsModule,
    BusinessSectorsModule,
    NudgesModule,
    AWSModule,
    MessagesModule,
    MessagingModule,
    SlackModule,
    MailsModule,
  ],
  controllers: [UserProfilesController],
  providers: [UserProfilesService],
  exports: [SequelizeModule, UserProfilesService],
})
export class UserProfilesModule {}
