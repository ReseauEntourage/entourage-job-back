import { Module } from '@nestjs/common';
import { LlmMetricsModule } from '../llm-metrics/llm-metrics.module';
import { VoyageAiService } from './voyageai.service';

@Module({
  imports: [LlmMetricsModule],
  providers: [VoyageAiService],
  exports: [VoyageAiService],
})
export class VoyageAiModule {}
