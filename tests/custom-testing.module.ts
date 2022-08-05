import { Module } from '@nestjs/common';

import { AppModule } from 'src/app.module';
import { AuthHelper } from './auth';
import { BusinessLineHelper } from './businessLines';
import {
  CVBusinessLineHelper,
  CVFactory,
  CVHelper,
  CVLocationHelper,
} from './cvs';
import { DatabaseHelper } from './database.helper';
import { LocationHelper } from './locations';
import { UserHelper, UserFactory, UserCandidatHelper } from './users';

@Module({
  imports: [AppModule],
  providers: [
    DatabaseHelper,
    AuthHelper,
    UserHelper,
    CVHelper,
    CVFactory,
    CVBusinessLineHelper,
    CVLocationHelper,
    LocationHelper,
    BusinessLineHelper,
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
