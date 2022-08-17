import { Module } from '@nestjs/common';
import { SkillsModule } from 'src/skills/skills.module';
import { SkillsHelper } from './skills.helper';

@Module({
  imports: [SkillsModule],
  providers: [SkillsHelper],
  exports: [SkillsHelper],
})
export class SkillsTestingModule {}
