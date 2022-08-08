import { forwardRef, Module } from '@nestjs/common';
import { AuthModule } from 'src/auth/auth.module';
import { UsersModule } from 'src/users/users.module';
import { UserCandidatsHelper } from './user-candidats.helper';
import { UserFactory } from './user.factory';
import { UsersHelper } from './users.helper';

@Module({
  imports: [UsersModule, AuthModule],
  providers: [UsersHelper, UserCandidatsHelper, UserFactory],
  exports: [UsersHelper, UserCandidatsHelper, UserFactory],
})
export class UsersTestingModule {}
