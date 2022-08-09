import { Module } from '@nestjs/common';

import { AppModule } from 'src/app.module';
import { AuthTestingModule } from './auth/auth-testing.module';
import { BusinessLinesTestingModule } from './businessLines/businessLines-testing.module';
import { CVsTestingModule } from './cvs/cvs-testing.module';
import { DatabaseHelper } from './database.helper';
import { LocationsTestingModule } from './locations/locations-testing.module';
import { UsersTestingModule } from './users/users-testing.module';

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
