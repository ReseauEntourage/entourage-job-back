import { Module } from '@nestjs/common';

import { AppModule } from 'src/app.module';
import { AmbitionsTestingModule } from './ambitions/ambitions-testing.module';
import { AuthTestingModule } from './auth/auth-testing.module';
import { BusinessLinesTestingModule } from './businessLines/businessLines-testing.module';
import { ContractsTestingModule } from './contracts/contracts-testing.module';
import { CVsTestingModule } from './cvs/cvs-testing.module';
import { DatabaseHelper } from './database.helper';
import { ExperiencesTestingModule } from './experiences/experiences-testing.module';
import { LanguagesTestingModule } from './languages/languages-testing.module';
import { LocationsTestingModule } from './locations/locations-testing.module';
import { PassionsTestingModule } from './passions/passions-testing.module';
import { ReviewsTestingModule } from './reviews/reviews-testing.module';
import { SkillsTestingModule } from './skills/skills-testing.module';
import { UsersTestingModule } from './users/users-testing.module';

@Module({
  imports: [
    AppModule,
    AuthTestingModule,
    BusinessLinesTestingModule,
    CVsTestingModule,
    LocationsTestingModule,
    AmbitionsTestingModule,
    ContractsTestingModule,
    ExperiencesTestingModule,
    LanguagesTestingModule,
    LocationsTestingModule,
    PassionsTestingModule,
    SkillsTestingModule,
    UsersTestingModule,
    ReviewsTestingModule,
  ],
  providers: [DatabaseHelper],
})
export class CustomTestingModule {}
