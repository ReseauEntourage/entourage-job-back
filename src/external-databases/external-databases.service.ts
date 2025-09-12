import { Injectable } from '@nestjs/common';
import { UpdateUserSocialSituationDto } from '../user-social-situations/dto/update-user-social-situation.dto';
import { CreateUserRegistrationDto } from '../users-creation/dto';
import { CandidateGender, CandidateGenders } from 'src/contacts/contacts.types';
import { QueuesService } from 'src/queues/producers/queues.service';
import { Jobs } from 'src/queues/queues.types';
import { Genders } from 'src/users/users.types';

@Injectable()
export class ExternalDatabasesService {
  constructor(private queuesService: QueuesService) {}

  async createExternalDBUser(
    userId: string,
    otherInfo: Pick<
      CreateUserRegistrationDto,
      'campaign' | 'birthDate' | 'workingRight' | 'gender' | 'refererEmail'
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

  async updateExternalDBUserSocialSituation(
    userId: string,
    data: Pick<
      UpdateUserSocialSituationDto,
      | 'nationality'
      | 'accommodation'
      | 'resources'
      | 'studiesLevel'
      | 'workingExperience'
      | 'jobSearchDuration'
    >
  ) {
    await this.queuesService.addToWorkQueue(
      Jobs.CREATE_OR_UPDATE_SALESFORCE_USER,
      {
        userId,
        ...data,
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
}
