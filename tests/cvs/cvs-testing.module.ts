import { Module } from '@nestjs/common';
import { AmbitionsModule } from 'src/common/ambitions/ambitions.module';
import { BusinessLinesModule } from 'src/common/business-lines/business-lines.module';
import { ContractsModule } from 'src/common/contracts/contracts.module';
import { ExperiencesModule } from 'src/common/experiences/experiences.module';
import { FormationsModule } from 'src/common/formations/formations.module';
import { LanguagesModule } from 'src/common/languages/languages.module';
import { LocationsModule } from 'src/common/locations/locations.module';
import { PassionsModule } from 'src/common/passions/passions.module';
import { ReviewsModule } from 'src/common/reviews/reviews.module';
import { SkillsModule } from 'src/common/skills/skills.module';
import { CVsModule } from 'src/cvs/cvs.module';
import { UsersModule } from 'src/users/users.module';
import { ExperiencesHelper } from 'tests/common/experiences/experiences.helper';
import { FormationsHelper } from 'tests/common/formations/formations.helper';
import { CVAmbitionsHelper } from './cv-ambitions.helper';
import { CVBusinessLinesHelper } from './cv-business-lines.helper';
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
    FormationsModule,
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
    FormationsHelper,
    ExperiencesHelper,
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
    FormationsHelper,
    ExperiencesHelper,
  ],
})
export class CVsTestingModule {}
