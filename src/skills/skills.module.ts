import { Module } from '@nestjs/common';
import { SequelizeModule } from '@nestjs/sequelize';
import { Skill } from './models';
import { SkillsController } from './skills.controller';
import { SkillsService } from './skills.service';

@Module({
  imports: [SequelizeModule.forFeature([Skill])],
  providers: [SkillsService],
  controllers: [SkillsController],
  exports: [SkillsService, SequelizeModule],
})
export class SkillsModule {}
