import { Module } from '@nestjs/common';
import { OpportunitiesModule } from 'src/opportunities/opportunities.module';
import { AirtableService } from './airtable.service';

@Module({
  imports: [OpportunitiesModule],
  providers: [AirtableService],
  exports: [AirtableService],
})
export class AirtableModule {}
