import { Module } from '@nestjs/common';
import { VoyageAiService } from './voyageai.service';

@Module({
  imports: [],
  providers: [VoyageAiService],
  exports: [VoyageAiService],
})
export class VoyageAiModule {}
