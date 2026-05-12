import { Module } from '@nestjs/common';
import { LlmMetricsModule } from 'src/external-services/llm-metrics/llm-metrics.module';
import { OpenAiService } from './openai.service';

@Module({
  imports: [LlmMetricsModule],
  providers: [OpenAiService],
  exports: [OpenAiService],
})
export class OpenAiModule {}
