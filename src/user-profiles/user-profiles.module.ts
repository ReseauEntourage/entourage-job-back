import { Module } from '@nestjs/common';
import { SequelizeModule } from '@nestjs/sequelize';
import { AmbitionsModule } from 'src/common/ambitions/ambitions.module';
import { BusinessLinesModule } from 'src/common/business-lines/business-lines.module';
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
    AmbitionsModule,
    BusinessLinesModule,
  ],
  controllers: [UserProfilesController],
  providers: [UserProfilesService],
  exports: [SequelizeModule, UserProfilesService],
})
export class UserProfilesModule {}
