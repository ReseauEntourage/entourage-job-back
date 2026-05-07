import { Module } from '@nestjs/common';
import { LlmMetricsModule } from 'src/external-services/llm-metrics/llm-metrics.module';
import { AnthropicService } from './anthropic.service';

@Module({
  imports: [LlmMetricsModule],
  providers: [AnthropicService],
  exports: [AnthropicService],
})
export class AnthropicModule {}
