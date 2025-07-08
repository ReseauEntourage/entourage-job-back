// eslint-disable-next-line import/no-unresolved
import { faker } from '@faker-js/faker';
import { Injectable } from '@nestjs/common';
import { InjectModel } from '@nestjs/sequelize';
import * as uuid from 'uuid';
import { Experience } from 'src/common/experiences/models';
import { Factory } from 'src/utils/types';

@Injectable()
export class ExperienceFactory implements Factory<Experience> {
  constructor(
    @InjectModel(Experience)
    private experienceModel: typeof Experience
  ) {}

  generateExperience(props: Partial<Experience>): Partial<Experience> {
    return {
      id: uuid.v4(),
      title: props.title || faker.lorem.words(3),
      description: props.description || faker.lorem.paragraph(),
      location: props.location || faker.address.city(),
      company: props.company || faker.company.name(),
      startDate: props.startDate || faker.date.past(5),
      endDate: props.endDate || faker.date.recent(365),
      skills: props.skills || [],
      userProfileId: props.userProfileId || null,
    };
  }

  async create(props: Partial<Experience> = {}): Promise<Experience> {
    const experience = this.generateExperience(props);
    return this.experienceModel.create(experience);
  }
}
