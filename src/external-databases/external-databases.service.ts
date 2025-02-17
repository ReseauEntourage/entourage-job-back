import { Injectable } from '@nestjs/common';
import { CreateUserRegistrationDto } from '../users-creation/dto';
import { CandidateGender, CandidateGenders } from 'src/contacts/contacts.types';
import { QueuesService } from 'src/queues/producers/queues.service';
import { Jobs } from 'src/queues/queues.types';
import { Genders } from 'src/users/users.types';

@Injectable()
export class ExternalDatabasesService {
  constructor(private queuesService: QueuesService) {}

  // TODO merge with createExternalDBOpportunity
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

  // TODO merge with updateExternalDBOpportunity
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

  async createExternalDBUser(
    userId: string,
    otherInfo: Pick<
      CreateUserRegistrationDto,
      | 'program'
      | 'campaign'
      | 'birthDate'
      | 'nationality'
      | 'accommodation'
      | 'hasSocialWorker'
      | 'resources'
      | 'studiesLevel'
      | 'workingExperience'
      | 'jobSearchDuration'
      | 'workingRight'
      | 'gender'
      | 'refererEmail'
    >
  ) {
    let conertedGenderType: CandidateGender;
    switch (otherInfo.gender) {
      case Genders.MALE:
        conertedGenderType = CandidateGenders.MALE;
        break;
      case Genders.FEMALE:
        conertedGenderType = CandidateGenders.FEMALE;
        break;
      case Genders.OTHER:
        conertedGenderType = CandidateGenders.OTHER;
        break;
      case undefined:
        conertedGenderType = null;
        break;
      default:
        throw new Error('Invalid gender value');
    }

    await this.queuesService.addToWorkQueue(
      Jobs.CREATE_OR_UPDATE_SALESFORCE_USER,
      {
        userId,
        ...otherInfo,
        gender: conertedGenderType,
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

  async createOrUpdateExternalDBTask(externalMessageId: string) {
    await this.queuesService.addToWorkQueue(
      Jobs.CREATE_OR_UPDATE_SALESFORCE_TASK,
      {
        externalMessageId,
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
