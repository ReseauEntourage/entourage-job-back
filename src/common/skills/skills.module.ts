import { Module } from '@nestjs/common';
import { SequelizeModule } from '@nestjs/sequelize';
import { Skill } from './models';

@Module({
  imports: [SequelizeModule.forFeature([Skill])],
  exports: [SequelizeModule],
})
export class SkillsModule {}
