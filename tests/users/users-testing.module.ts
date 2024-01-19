import { Module } from '@nestjs/common';
import { AuthModule } from 'src/auth/auth.module';
import { UserProfilesModule } from 'src/user-profiles/user-profiles.module';
import { UsersModule } from 'src/users/users.module';
import { UserCandidatsHelper } from './user-candidats.helper';
import { UserProfilesHelper } from './user-profiles.helper';
import { UserFactory } from './user.factory';
import { UsersHelper } from './users.helper';

@Module({
  imports: [UserProfilesModule, UsersModule, AuthModule],
  providers: [
    UsersHelper,
    UserCandidatsHelper,
    UserProfilesHelper,
    UserFactory,
  ],
  exports: [UsersHelper, UserCandidatsHelper, UserProfilesHelper, UserFactory],
})
export class UsersTestingModule {}
