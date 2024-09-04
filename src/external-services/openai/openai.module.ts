import { Module } from '@nestjs/common';
import { OpenAiService } from './openai.service';

@Module({
  imports: [],
  providers: [OpenAiService],
  exports: [OpenAiService],
})
export class OpenAiModule {}
