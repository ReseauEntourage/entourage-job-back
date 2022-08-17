import { Module } from '@nestjs/common';
import { SequelizeModule } from '@nestjs/sequelize';
import { Experience, ExperienceSkill } from './models';

@Module({
  imports: [SequelizeModule.forFeature([Experience, ExperienceSkill])],
  exports: [SequelizeModule],
})
export class ExperiencesModule {}
