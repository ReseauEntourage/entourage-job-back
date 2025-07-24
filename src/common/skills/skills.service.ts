import { Injectable } from '@nestjs/common';
import { InjectModel } from '@nestjs/sequelize';
import sequelize, { Op } from 'sequelize';
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

  async findSkillsByUserProfileId(userProfileId: string): Promise<Skill[]> {
    return this.skillModel.findAll({
      where: {
        userProfileId,
        order: {
          [Op.ne]: -1,
        },
      },
      attributes: ['id', 'name', 'order'],
      order: [['order', 'ASC']],
    });
  }
}
