import { Module } from '@nestjs/common';
import { ExperiencesModule } from 'src/common/experiences/experiences.module';
import { ExperienceFactory } from './experience.factory';

@Module({
  imports: [ExperiencesModule],
  providers: [ExperienceFactory],
  exports: [],
})
export class ExperiencesTestingModule {}
