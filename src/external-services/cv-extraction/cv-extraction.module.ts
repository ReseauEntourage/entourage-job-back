import { Module } from '@nestjs/common';
import { AnthropicModule } from 'src/external-services/anthropic/anthropic.module';
import { LlmMetricsModule } from 'src/external-services/llm-metrics/llm-metrics.module';
import { CvExtractionService } from './cv-extraction.service';

@Module({
  imports: [AnthropicModule, LlmMetricsModule],
  providers: [CvExtractionService],
  exports: [CvExtractionService],
})
export class CvExtractionModule {}
