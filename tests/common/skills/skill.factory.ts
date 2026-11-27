import { randomUUID } from 'crypto';
import { faker } from '@faker-js/faker';
import { Injectable } from '@nestjs/common';
import { InjectModel } from '@nestjs/sequelize';
import { Skill } from 'src/skills/models';
import { Factory } from 'src/utils/types';

@Injectable()
export class SkillFactory implements Factory<Skill> {
  constructor(
    @InjectModel(Skill)
    private skillModel: typeof Skill
  ) {}

  generateSkill(props: Partial<Skill>): Partial<Skill> {
    return {
      id: randomUUID(),
      name: props.name || faker.lorem.word(),
    };
  }

  async create(props: Partial<Skill> = {}): Promise<Skill> {
    const skill = this.generateSkill(props);
    return this.skillModel.create(skill);
  }
}
