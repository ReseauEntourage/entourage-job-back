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
    await this.queuesService.addToWorkQueue(
      Jobs.CREATE_OR_UPDATE_SALESFORCE_OPPORTUNITY,
      {
        opportunityId,
        isSameOpportunity,
      }
    );
  }

  async createOrUpdateExternalDBEvent(opportunityUserEventId: string) {
    await this.queuesService.addToWorkQueue(
      Jobs.CREATE_OR_UPDATE_SALESFORCE_EVENT,
      {
        opportunityUserEventId,
      }
    );
  }

  async refreshSalesforceOpportunities(opportunitiesIds: string[]) {
    await this.queuesService.addToWorkQueue(
      Jobs.CREATE_OR_UPDATE_SALESFORCE_OPPORTUNITY,
      {
        opportunityId: opportunitiesIds,
        isSameOpportunity: false,
      }
    );
  }

  async refreshSalesforceEvents(opportunityUserEventsIds: string[]) {
    await this.queuesService.addToWorkQueue(
      Jobs.CREATE_OR_UPDATE_SALESFORCE_EVENT,
      {
        opportunityUserEventId: opportunityUserEventsIds,
      }
    );
  }
}
