import { Module } from '@nestjs/common';
import { UserProfilesHelper } from '../user-profiles/user-profiles.helper';
import { AuthModule } from 'src/auth/auth.module';
import { BusinessSectorsModule } from 'src/common/business-sectors/business-sectors.module';
import { UserProfilesModule } from 'src/user-profiles/user-profiles.module';
import { UserSocialSituationsModule } from 'src/user-social-situations/user-social-situations.module';
import { UsersModule } from 'src/users/users.module';
import { BusinessSectorsTestingModule } from 'tests/business-sectors/business-sectors-testing.module';
import { NudgesTestingModule } from 'tests/nudges/nudges-testing.module';
import { UserCandidatsHelper } from './user-candidats.helper';
import { UserFactory } from './user.factory';
import { UsersHelper } from './users.helper';

@Module({
  imports: [
    UserProfilesModule,
    BusinessSectorsModule,
    UsersModule,
    UserSocialSituationsModule,
    AuthModule,
    NudgesTestingModule,
    BusinessSectorsTestingModule,
  ],
  providers: [
    UsersHelper,
    UserCandidatsHelper,
    UserProfilesHelper,
    UserFactory,
  ],
  exports: [UsersHelper, UserCandidatsHelper, UserProfilesHelper, UserFactory],
})
export class UsersTestingModule {}
