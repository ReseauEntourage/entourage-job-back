import { Module } from '@nestjs/common';
import { SequelizeModule } from '@nestjs/sequelize';
import { Experience, ExperienceSkill } from 'src/experiences/models';
import { ExperienceFactory } from './experience.factory';

@Module({
  imports: [SequelizeModule.forFeature([Experience, ExperienceSkill])],
  providers: [ExperienceFactory],
  exports: [],
})
export class ExperiencesTestingModule {}
