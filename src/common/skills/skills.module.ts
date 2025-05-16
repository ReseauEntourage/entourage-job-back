import { Module } from '@nestjs/common';
import { SequelizeModule } from '@nestjs/sequelize';
import { Skill } from './models';
import { SkillsService } from './skills.service';

@Module({
  imports: [SequelizeModule.forFeature([Skill])],
  providers: [SkillsService],
  exports: [SkillsService, SequelizeModule],
})
export class SkillsModule {}
