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

  async findOneByUserId(userId: string): Promise<UserSocialSituation> {
    return this.userSocialSituationModel.findOne({
      where: { userId: userId },
    });
  }

  async createOrUpdateSocialSituation(
    userId: string,
    updateUserSocialSituationDto: UpdateUserSocialSituationDto
  ) {
    // Prepare the data for the external database and the database
    const {
      networkInsecurity,
      materialInsecurity,
      hasCompletedSurvey,
      ...externalDBData
    } = updateUserSocialSituationDto;

    // Update the data in the external database
    await this.updateSocialSituationExternalDBUser(userId, externalDBData);

    // Prepare the data for the database
    const userSocialSituationDbData = {
      userId,
      networkInsecurity,
      materialInsecurity,
      hasCompletedSurvey,
    };

    const userSocialSituation = await this.findOneByUserId(userId);

    // Create the userSocialSituation to be saved in salesforce if it doesn't exist
    if (!userSocialSituation) {
      return this.userSocialSituationModel.create({
        userId,
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
