import { Module } from '@nestjs/common';
import { AuthModule } from 'src/auth/auth.module';
import { BusinessSectorsModule } from 'src/common/business-sectors/business-sectors.module';
import { UserProfilesModule } from 'src/user-profiles/user-profiles.module';
import { UserSocialSituationsModule } from 'src/user-social-situations/user-social-situations.module';
import { UsersModule } from 'src/users/users.module';
import { NudgesTestingModule } from 'tests/common/nudges/nudges-testing.module';
import { BusinessSectorFactory } from './business-sector.factory';
import { BusinessSectorHelper } from './business-sector.helper';
import { UserCandidatsHelper } from './user-candidats.helper';
import { UserProfilesHelper } from './user-profiles.helper';
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
  ],
  providers: [
    UsersHelper,
    UserCandidatsHelper,
    UserProfilesHelper,
    UserFactory,
    BusinessSectorFactory,
    BusinessSectorHelper,
  ],
  exports: [
    UsersHelper,
    UserCandidatsHelper,
    UserProfilesHelper,
    UserFactory,
    BusinessSectorHelper,
  ],
})
export class UsersTestingModule {}
