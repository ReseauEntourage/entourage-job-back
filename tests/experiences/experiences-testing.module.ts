import { Module } from '@nestjs/common';
import { ExperiencesModule } from 'src/experiences/experiences.module';
import { ExperiencesSkillsHelper } from './experiences-skills.helper';
import { ExperiencesHelper } from './experiences.helper';

@Module({
  imports: [ExperiencesModule],
  providers: [ExperiencesHelper, ExperiencesSkillsHelper],
  exports: [ExperiencesHelper, ExperiencesSkillsHelper],
})
export class ExperiencesTestingModule {}
