import { Module } from '@nestjs/common';

import { AuthHelper } from 'test/auth/auth.helper';
import { DatabaseHelper } from 'test/database.helper';
import { UserFactory } from 'test/users/user.factory';
import { UserHelper } from 'test/users/user.helper';
import { AppModule } from 'src/app.module';

@Module({
  imports: [AppModule],
  providers: [DatabaseHelper, AuthHelper, UserHelper, UserFactory],
  exports: [AppModule, DatabaseHelper, AuthHelper, UserHelper, UserFactory],
})
export class CustomTestingModule {}
