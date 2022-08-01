import { Module } from '@nestjs/common';

import { AppModule } from 'src/app.module';
import { AuthHelper } from './auth/auth.helper';
import { CVFactory } from './cvs/cv.factory';
import { CVHelper } from './cvs/cv.helper';
import { DatabaseHelper } from './database.helper';
import { UserCandidatHelper } from './users/user-candidat.helper';
import { UserFactory } from './users/user.factory';
import { UserHelper } from './users/user.helper';

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
