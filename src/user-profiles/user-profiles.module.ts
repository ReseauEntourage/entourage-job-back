import { Module } from '@nestjs/common';
import { SequelizeModule } from '@nestjs/sequelize';
import { AmbitionsModule } from 'src/common/ambitions/ambitions.module';
import { BusinessLinesModule } from 'src/common/business-lines/business-lines.module';
import { AWSModule } from 'src/external-services/aws/aws.module';
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
    ]),
    UsersModule,
    AmbitionsModule,
    BusinessLinesModule,
    AWSModule,
    MessagesModule,
  ],
  controllers: [UserProfilesController],
  providers: [UserProfilesService],
  exports: [SequelizeModule, UserProfilesService],
})
export class UserProfilesModule {}
