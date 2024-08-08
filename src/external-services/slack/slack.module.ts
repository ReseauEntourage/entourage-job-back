import { Module } from '@nestjs/common';
import { SlackBlockBuilderService } from './slack-block-builder.service';
import { SlackService } from './slack.service';

@Module({
  imports: [],
  providers: [SlackService, SlackBlockBuilderService],
  exports: [SlackService, SlackBlockBuilderService],
})
export class SlackModule {}
