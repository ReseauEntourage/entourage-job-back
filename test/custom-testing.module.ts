import { Module } from '@nestjs/common';

import { DatabaseHelper } from './database.helper';
import { AuthHelper } from './auth/auth.helper';
import { UserHelper } from './users/user.helper';
import { UserFactory } from './users/user.factory';
import { AppModule } from '../src/app.module';

@Module({
  imports: [AppModule],
  providers: [DatabaseHelper, AuthHelper, UserHelper, UserFactory],
  exports: [AppModule, DatabaseHelper, AuthHelper, UserHelper, UserFactory],
})
export class CustomTestingModule {}
