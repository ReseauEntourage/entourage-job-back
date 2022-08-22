import { Module } from '@nestjs/common';
import { AmbitionsModule } from 'src/ambitions/ambitions.module';
import { BusinessLinesModule } from 'src/businessLines/businessLines.module';
import { ContractsModule } from 'src/contracts/contracts.module';
import { CVsModule } from 'src/cvs/cvs.module';
import { ExperiencesModule } from 'src/experiences/experiences.module';
import { LanguagesModule } from 'src/languages/languages.module';
import { LocationsModule } from 'src/locations/locations.module';
import { PassionsModule } from 'src/passions/passions.module';
import { ReviewsModule } from 'src/reviews/reviews.module';
import { SkillsModule } from 'src/skills/skills.module';
import { UsersModule } from 'src/users/users.module';
import { CVAmbitionsHelper } from './cv-ambitions.helper';
import { CVBusinessLinesHelper } from './cv-businessLines.helper';
import { CVContractsHelper } from './cv-contracts.helper';
import { CVLanguagesHelper } from './cv-languages.helper';
import { CVLocationsHelper } from './cv-locations.helper';
import { CVPassionsHelper } from './cv-passions.helper';
import { CVSearchesHelper } from './cv-searches.helper';
import { CVSkillsHelper } from './cv-skills.helper';
import { CVFactory } from './cv.factory';
import { CVsHelper } from './cvs.helper';

@Module({
  imports: [
    CVsModule,
    LocationsModule,
    BusinessLinesModule,
    UsersModule,
    BusinessLinesModule,
    LocationsModule,
    AmbitionsModule,
    ContractsModule,
    LanguagesModule,
    PassionsModule,
    SkillsModule,
    ExperiencesModule,
    ReviewsModule,
  ],
  providers: [
    CVBusinessLinesHelper,
    CVLocationsHelper,
    CVPassionsHelper,
    CVSkillsHelper,
    CVSearchesHelper,
    CVLanguagesHelper,
    CVAmbitionsHelper,
    CVContractsHelper,
    CVFactory,
    CVsHelper,
  ],
  exports: [
    CVBusinessLinesHelper,
    CVLocationsHelper,
    CVPassionsHelper,
    CVSkillsHelper,
    CVSearchesHelper,
    CVLanguagesHelper,
    CVAmbitionsHelper,
    CVContractsHelper,
    CVFactory,
    CVsHelper,
  ],
})
export class CVsTestingModule {}
