import { Module } from '@nestjs/common';
import { NudgesModule } from 'src/common/nudge/nudges.module';
import { NudgeFactory } from './nudge.factory';
import { NudgesHelper } from './nudges.helper';

@Module({
  imports: [NudgesModule],
  providers: [NudgesHelper, NudgeFactory],
  exports: [NudgesHelper],
})
export class NudgesTestingModule {}
