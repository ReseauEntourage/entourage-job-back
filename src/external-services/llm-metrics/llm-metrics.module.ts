import { Module } from '@nestjs/common';
import { LlmMetricsService } from './llm-metrics.service';

@Module({
  providers: [LlmMetricsService],
  exports: [LlmMetricsService],
})
export class LlmMetricsModule {}
