import { Module } from '@nestjs/common';
import { SlackService } from './slack.service';

@Module({
  imports: [],
  providers: [SlackService],
  exports: [],
})
export class SlackModule {}
