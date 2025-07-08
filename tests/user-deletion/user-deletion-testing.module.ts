import { Module } from '@nestjs/common';
import { UsersTestingModule } from 'tests/users/users-testing.module';

@Module({
  imports: [UsersTestingModule],
  providers: [],
  exports: [],
})
export class UserDeletionTestingModule {}
