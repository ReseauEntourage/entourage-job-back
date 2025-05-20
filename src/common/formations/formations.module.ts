import { Module } from '@nestjs/common';
import { SequelizeModule } from '@nestjs/sequelize';
import { SkillsModule } from '../skills/skills.module';
import { FormationsService } from './formations.service';
import { Formation, FormationSkill } from './models';

@Module({
  imports: [
    SequelizeModule.forFeature([Formation, FormationSkill]),
    SkillsModule,
  ],
  providers: [FormationsService],
  exports: [FormationsService, SequelizeModule],
})
export class FormationsModule {}
