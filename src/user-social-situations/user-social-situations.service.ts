import { Injectable } from '@nestjs/common';
import { InjectModel } from '@nestjs/sequelize';
import { ExternalDatabasesService } from 'src/external-databases/external-databases.service';
import { UpdateUserSocialSituationDto } from './dto/update-user-social-situation.dto';
import { UserSocialSituation } from './models';

@Injectable()
export class UserSocialSituationsService {
  constructor(
    @InjectModel(UserSocialSituation)
    private userSocialSituationModel: typeof UserSocialSituation,
    private externalDatabasesService: ExternalDatabasesService
  ) {}

  async findOneByCandidateId(
    candidateId: string
  ): Promise<UserSocialSituation> {
    return this.userSocialSituationModel.findOne({
      where: { candidateId: candidateId },
    });
  }

  async createOrUpdateSocialSituation(
    candidateId: string,
    updateUserSocialSituationDto: UpdateUserSocialSituationDto
  ) {
    const userSocialSituation = await this.findOneByCandidateId(candidateId);

    // Prepare the data for the external database and the database
    const {
      networkInsecurity,
      materialInsecurity,
      hasCompletedSurvey,
      ...externalDBData
    } = updateUserSocialSituationDto;

    // Update the data in the external database
    await this.updateSocialSituationExternalDBUser(
      userSocialSituation.candidateId,
      externalDBData
    );

    // Prepare the data for the database
    const userSocialSituationDbData = {
      candidateId,
      networkInsecurity,
      materialInsecurity,
      hasCompletedSurvey,
    };

    // Create the userSocialSituation to be saved in salesforce if it doesn't exist
    if (!userSocialSituation) {
      return this.userSocialSituationModel.create({
        candidateId,
        userSocialSituationDbData,
      });
    }

    // Update the data in the database
    return userSocialSituation.update(userSocialSituationDbData);
  }

  private async updateSocialSituationExternalDBUser(
    createdUserId: string,
    data: Pick<
      UpdateUserSocialSituationDto,
      | 'materialInsecurity'
      | 'networkInsecurity'
      | 'nationality'
      | 'accommodation'
      | 'resources'
      | 'studiesLevel'
      | 'workingExperience'
      | 'jobSearchDuration'
    >
  ) {
    return this.externalDatabasesService.updateExternalDBUserSocialSituation(
      createdUserId,
      data
    );
  }
}
