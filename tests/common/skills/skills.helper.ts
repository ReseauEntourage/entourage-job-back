import { Injectable } from '@nestjs/common';
import { InjectModel } from '@nestjs/sequelize';
import { Op } from 'sequelize';
import { Skill } from 'src/common/skills/models';

@Injectable()
export class SkillsHelper {
  constructor(
    @InjectModel(Skill)
    private skillModel: typeof Skill
  ) {}

  async countSkillsByName(names: string | string[]) {
    if (!Array.isArray(names)) {
      names = [names];
    }
    return this.skillModel.count({
      where: {
        name: {
          [Op.or]: names,
        },
      },
    });
  }
}
