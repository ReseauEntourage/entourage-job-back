import { randomUUID } from 'crypto';
import { faker } from '@faker-js/faker';
import { Injectable } from '@nestjs/common';
import { InjectModel } from '@nestjs/sequelize';
import { Formation } from 'src/formations/models';
import { Factory } from 'src/utils/types';

@Injectable()
export class FormationFactory implements Factory<Formation> {
  constructor(
    @InjectModel(Formation)
    private formationModel: typeof Formation
  ) {}

  generateFormation(props: Partial<Formation>): Partial<Formation> {
    return {
      id: randomUUID(),
      title: props.title || faker.lorem.words(3),
      description: props.description || faker.lorem.paragraph(),
      location: props.location || faker.location.city(),
      institution: props.institution || faker.company.name(),
      startDate: props.startDate || faker.date.past({ years: 5 }),
      endDate: props.endDate || faker.date.recent({ days: 365 }),
      skills: props.skills || [],
      userProfileId: props.userProfileId || null,
    };
  }

  async create(props: Partial<Formation> = {}): Promise<Formation> {
    const formation = this.generateFormation(props);
    return this.formationModel.create(formation);
  }
}
