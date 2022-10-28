import { InjectQueue } from '@nestjs/bull';
import { Injectable } from '@nestjs/common';
import { Queue } from 'bull';
import { Jobs, Queues } from 'src/queues/queues.types';

@Injectable()
export class ExternalDatabasesService {
  constructor(
    @InjectQueue(Queues.WORK)
    private workQueue: Queue
  ) {}

  async updateExternalDBOpportunity(
    opportunityId: string | string[],
    isSameOpportunity = false
  ) {
    // TODO remove after removing Airtable
    if (Array.isArray(opportunityId)) {
      await Promise.all([
        opportunityId.map(async (singleOpportunityId) => {
          return this.workQueue.add(Jobs.UPDATE_AIRTABLE, {
            tableName: process.env.AIRTABLE_OFFERS,
            opportunityId: singleOpportunityId,
          });
        }),
      ]);
    } else {
      await this.workQueue.add(Jobs.UPDATE_AIRTABLE, {
        tableName: process.env.AIRTABLE_OFFERS,
        opportunityId,
      });
    }

    await this.workQueue.add(Jobs.CREATE_OR_UPDATE_SALESFORCE_OPPORTUNITY, {
      opportunityId,
      isSameOpportunity,
    });
  }

  async createExternalDBOpportunity(
    opportunityId: string | string[],
    isSameOpportunity = false
  ) {
    // TODO remove after removing Airtable
    if (Array.isArray(opportunityId)) {
      await Promise.all([
        opportunityId.map(async (singleOpportunityId) => {
          return this.workQueue.add(Jobs.INSERT_AIRTABLE, {
            tableName: process.env.AIRTABLE_OFFERS,
            opportunityId: singleOpportunityId,
          });
        }),
      ]);
    } else {
      await this.workQueue.add(Jobs.INSERT_AIRTABLE, {
        tableName: process.env.AIRTABLE_OFFERS,
        opportunityId,
      });
    }

    await this.workQueue.add(Jobs.CREATE_OR_UPDATE_SALESFORCE_OPPORTUNITY, {
      opportunityId,
      isSameOpportunity,
    });
  }
}
