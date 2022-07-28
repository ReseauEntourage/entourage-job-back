import { Module } from '@nestjs/common';

import { AppModule } from 'src/app.module';
import { AuthHelper } from './auth/auth.helper';
import { DatabaseHelper } from './database.helper';
import { UserFactory } from './users/user.factory';
import { UserHelper } from './users/user.helper';
import { UserCandidatHelper } from './users/user-candidat.helper';

@Module({
  imports: [AppModule],
  providers: [
    DatabaseHelper,
    AuthHelper,
    UserHelper,
    UserCandidatHelper,
    UserFactory,
  ],
  exports: [
    AppModule,
    DatabaseHelper,
    AuthHelper,
    UserHelper,
    UserCandidatHelper,
    UserFactory,
  ],
})
export class CustomTestingModule {}
