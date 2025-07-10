import { Module } from '@nestjs/common';
import { SkillsModule } from 'src/common/skills/skills.module';
import { SkillFactory } from './skill.factory';
import { SkillsHelper } from './skills.helper';

@Module({
  imports: [SkillsModule],
  providers: [SkillsHelper, SkillFactory],
  exports: [SkillsHelper, SkillFactory],
})
export class SkillsTestingModule {}
