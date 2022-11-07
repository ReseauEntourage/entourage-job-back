import { Injectable } from '@nestjs/common';
import { QueuesService } from 'src/queues/producers/queues.service';
import { Jobs } from 'src/queues/queues.types';

@Injectable()
export class ExternalDatabasesService {
  constructor(private queuesService: QueuesService) {}

  async updateExternalDBOpportunity(
    opportunityId: string | string[],
    isSameOpportunity = false
  ) {
    // TODO remove after removing Airtable
    if (Array.isArray(opportunityId)) {
      await Promise.all([
        opportunityId.map(async (singleOpportunityId) => {
          return this.queuesService.addToWorkQueue(Jobs.UPDATE_AIRTABLE, {
            tableName: process.env.AIRTABLE_OFFERS,
            opportunityId: singleOpportunityId,
          });
        }),
      ]);
    } else {
      await this.queuesService.addToWorkQueue(Jobs.UPDATE_AIRTABLE, {
        tableName: process.env.AIRTABLE_OFFERS,
        opportunityId,
      });
    }

    await this.queuesService.addToWorkQueue(
      Jobs.CREATE_OR_UPDATE_SALESFORCE_OPPORTUNITY,
      {
        opportunityId,
        isSameOpportunity,
      }
    );
  }

  async createExternalDBOpportunity(
    opportunityId: string | string[],
    isSameOpportunity = false
  ) {
    // TODO remove after removing Airtable
    if (Array.isArray(opportunityId)) {
      await Promise.all([
        opportunityId.map(async (singleOpportunityId) => {
          return this.queuesService.addToWorkQueue(Jobs.INSERT_AIRTABLE, {
            tableName: process.env.AIRTABLE_OFFERS,
            opportunityId: singleOpportunityId,
          });
        }),
      ]);
    } else {
      await this.queuesService.addToWorkQueue(Jobs.INSERT_AIRTABLE, {
        tableName: process.env.AIRTABLE_OFFERS,
        opportunityId,
      });
    }

    await this.queuesService.addToWorkQueue(
      Jobs.CREATE_OR_UPDATE_SALESFORCE_OPPORTUNITY,
      {
        opportunityId,
        isSameOpportunity,
      }
    );
  }
}
