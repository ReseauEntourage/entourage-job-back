import { faker } from '@faker-js/faker';
import { Injectable } from '@nestjs/common';
import { InjectModel } from '@nestjs/sequelize';
import { RecruitementAlert } from 'src/recruitement-alerts/models';
import { Factory } from 'src/utils/types';

@Injectable()
export class RecruitementAlertFactory implements Factory<RecruitementAlert> {
  constructor(
    @InjectModel(RecruitementAlert)
    private recruitementAlertModel: typeof RecruitementAlert
  ) {}

  generateRecruitementAlert(
    props: Partial<RecruitementAlert>
  ): Partial<RecruitementAlert> {
    return {
      name: faker.company.catchPhrase(),
      jobName: faker.name.jobTitle(),
      ...props,
    };
  }

  async create(
    props: Partial<RecruitementAlert> = {}
  ): Promise<RecruitementAlert> {
    const recruitementAlertData = this.generateRecruitementAlert(props);
    const recruitementAlert = await this.recruitementAlertModel.create(
      recruitementAlertData,
      { hooks: true }
    );

    return recruitementAlert.toJSON();
  }
}
