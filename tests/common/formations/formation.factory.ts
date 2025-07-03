// eslint-disable-next-line import/no-unresolved
import { faker } from '@faker-js/faker';
import { Injectable } from '@nestjs/common';
import { InjectModel } from '@nestjs/sequelize';
import * as uuid from 'uuid';
import { Formation } from 'src/common/formations/models';
import { Factory } from 'src/utils/types';

@Injectable()
export class FormationFactory implements Factory<Formation> {
  constructor(
    @InjectModel(Formation)
    private formationModel: typeof Formation
  ) {}

  generateFormation(props: Partial<Formation>): Partial<Formation> {
    return {
      id: uuid.v4(),
      title: props.title || faker.lorem.words(3),
      description: props.description || faker.lorem.paragraph(),
      location: props.location || faker.address.city(),
      institution: props.institution || faker.company.name(),
      startDate: props.startDate || faker.date.past(5),
      endDate: props.endDate || faker.date.recent(365),
      skills: props.skills || [],
      userProfileId: props.userProfileId || null,
    };
  }

  async create(props: Partial<Formation> = {}): Promise<Formation> {
    const formation = this.generateFormation(props);
    return this.formationModel.create(formation);
  }
}
