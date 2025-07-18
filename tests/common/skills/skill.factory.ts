// eslint-disable-next-line import/no-unresolved
import { faker } from '@faker-js/faker';
import { Injectable } from '@nestjs/common';
import { InjectModel } from '@nestjs/sequelize';
import * as uuid from 'uuid';
import { Skill } from 'src/common/skills/models';
import { Factory } from 'src/utils/types';

@Injectable()
export class SkillFactory implements Factory<Skill> {
  constructor(
    @InjectModel(Skill)
    private skillModel: typeof Skill
  ) {}

  generateSkill(props: Partial<Skill>): Partial<Skill> {
    return {
      id: uuid.v4(),
      name: props.name || faker.lorem.word(),
      order: props.order || faker.datatype.number({ min: 1, max: 100 }),
      userProfileId: props.userProfileId || null,
    };
  }

  async create(props: Partial<Skill> = {}): Promise<Skill> {
    const skill = this.generateSkill(props);
    return this.skillModel.create(skill);
  }
}
