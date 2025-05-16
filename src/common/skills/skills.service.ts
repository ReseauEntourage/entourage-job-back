import { Injectable } from '@nestjs/common';
import { InjectModel } from '@nestjs/sequelize';
import sequelize from 'sequelize';
import { Skill } from './models';

@Injectable()
export class SkillsService {
  constructor(
    @InjectModel(Skill)
    private skillModel: typeof Skill
  ) {}

  async bulkCreateSkills(
    skillsData: Partial<Skill>[],
    transaction?: sequelize.Transaction
  ): Promise<Skill[]> {
    return this.skillModel.bulkCreate(skillsData, {
      transaction,
      hooks: true,
    });
  }
}
