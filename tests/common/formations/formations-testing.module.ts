import { Module } from '@nestjs/common';
import { FormationsModule } from 'src/common/formations/formations.module';
import { FormationsSkillsHelper } from './formations-skills.helper';
import { FormationsHelper } from './formations.helper';

@Module({
  imports: [FormationsModule],
  providers: [FormationsHelper, FormationsSkillsHelper],
  exports: [FormationsHelper, FormationsSkillsHelper],
})
export class FormationsTestingModule {}
