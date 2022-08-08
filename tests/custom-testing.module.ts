import { Module } from '@nestjs/common';

import { AppModule } from 'src/app.module';
import { AuthTestingModule } from './auth';
import { BusinessLinesTestingModule } from './businessLines/businessLines-testing.module';
import { CVsTestingModule } from './cvs';
import { DatabaseHelper } from './database.helper';
import { LocationsTestingModule } from './locations';
import { UsersTestingModule } from './users';

@Module({
  imports: [
    AppModule,
    AuthTestingModule,
    BusinessLinesTestingModule,
    CVsTestingModule,
    LocationsTestingModule,
    UsersTestingModule,
  ],
  providers: [DatabaseHelper],
})
export class CustomTestingModule {}
