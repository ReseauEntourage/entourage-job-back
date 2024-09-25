import { Module } from '@nestjs/common';
import { SequelizeModule } from '@nestjs/sequelize';
import { AmbitionsModule } from 'src/common/ambitions/ambitions.module';
import { BusinessLinesModule } from 'src/common/business-lines/business-lines.module';
import { AWSModule } from 'src/external-services/aws/aws.module';
import { SlackModule } from 'src/external-services/slack/slack.module';
import { MailsModule } from 'src/mails/mails.module';
import { MessagesModule } from 'src/messages/messages.module';
import { UsersModule } from 'src/users/users.module';
import {
  HelpNeed,
  HelpOffer,
  UserProfile,
  UserProfileNetworkBusinessLine,
  UserProfileSearchAmbition,
  UserProfileSearchBusinessLine,
} from './models';
import { UserProfileRecommendation } from './models/user-profile-recommendation.model';
import { UserProfilesController } from './user-profiles.controller';
import { UserProfilesService } from './user-profiles.service';

@Module({
  imports: [
    SequelizeModule.forFeature([
      UserProfile,
      UserProfileSearchAmbition,
      UserProfileSearchBusinessLine,
      UserProfileNetworkBusinessLine,
      HelpNeed,
      HelpOffer,
      UserProfileRecommendation,
    ]),
    UsersModule,
    AmbitionsModule,
    BusinessLinesModule,
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
