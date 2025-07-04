import { Module } from '@nestjs/common';
import { AuthModule } from 'src/auth/auth.module';
import { BusinessSectorsModule } from 'src/common/business-sectors/business-sectors.module';
import { UserProfilesModule } from 'src/user-profiles/user-profiles.module';
import { UserSocialSituationsModule } from 'src/user-social-situations/user-social-situations.module';
import { UsersModule } from 'src/users/users.module';
import { BusinessSectorsTestingModule } from 'tests/business-sectors/business-sectors-testing.module';
import { NudgesTestingModule } from 'tests/nudges/nudges-testing.module';
import { UsersTestingModule } from 'tests/users/users-testing.module';

@Module({
  imports: [
    UsersTestingModule,
    UserProfilesModule,
    BusinessSectorsModule,
    UsersModule,
    UserSocialSituationsModule,
    AuthModule,
    NudgesTestingModule,
    BusinessSectorsTestingModule,
  ],
  providers: [],
  exports: [],
})
export class UserCreationTestingModule {}
