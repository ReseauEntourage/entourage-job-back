import { Module } from '@nestjs/common';

import { AppModule } from 'src/app.module';
import { AuthHelper } from './auth';
import { CVFactory, CVHelper } from './cvs';
import { DatabaseHelper } from './database.helper';
import { UserHelper, UserFactory } from './users';
import { UserCandidatHelper } from './users/user-candidat.helper';

@Module({
  imports: [AppModule],
  providers: [
    DatabaseHelper,
    AuthHelper,
    UserHelper,
    CVHelper,
    CVFactory,
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
    CVHelper,
    CVFactory,
  ],
})
export class CustomTestingModule {}
