import { Module } from '@nestjs/common';

import { AppModule } from 'src/app.module';
import { AuthHelper } from './auth/auth.helper';
import { DatabaseHelper } from './database.helper';
import { UserFactory } from './users/user.factory';
import { UserHelper } from './users/user.helper';

@Module({
  imports: [AppModule],
  providers: [DatabaseHelper, AuthHelper, UserHelper, UserFactory],
  exports: [AppModule, DatabaseHelper, AuthHelper, UserHelper, UserFactory],
})
export class CustomTestingModule {}
