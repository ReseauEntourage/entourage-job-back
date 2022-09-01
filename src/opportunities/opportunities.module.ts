import { Module } from '@nestjs/common';
import { OpportunitiesService } from './opportunities.service';
import { OpportunitiesController } from './opportunities.controller';

@Module({
  controllers: [OpportunitiesController],
  providers: [OpportunitiesService]
})
export class OpportunitiesModule {}
