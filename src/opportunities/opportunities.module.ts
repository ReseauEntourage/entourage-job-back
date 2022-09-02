import { Module } from '@nestjs/common';
import { SequelizeModule } from '@nestjs/sequelize';
import {
  Opportunity,
  OpportunityBusinessLine,
  OpportunityUser,
} from './models';
import { OpportunitiesController } from './opportunities.controller';
import { OpportunitiesService } from './opportunities.service';

@Module({
  imports: [
    SequelizeModule.forFeature([
      Opportunity,
      OpportunityUser,
      OpportunityBusinessLine,
    ]),
  ],
  controllers: [OpportunitiesController],
  providers: [OpportunitiesService],
  exports: [SequelizeModule, OpportunitiesService],
})
export class OpportunitiesModule {}
