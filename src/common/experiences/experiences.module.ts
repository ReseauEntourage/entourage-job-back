import { Module } from '@nestjs/common';
import { SequelizeModule } from '@nestjs/sequelize';
import { SkillsModule } from '../skills/skills.module';
import { ExperiencesService } from './experiences.service';
import { Experience, ExperienceSkill } from './models';

@Module({
  imports: [
    SequelizeModule.forFeature([Experience, ExperienceSkill]),
    SkillsModule,
  ],
  providers: [ExperiencesService],
  exports: [SequelizeModule, ExperiencesService],
})
export class ExperiencesModule {}
