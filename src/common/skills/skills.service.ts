import { Injectable } from '@nestjs/common';
import { InjectModel } from '@nestjs/sequelize';
import sequelize from 'sequelize';
import { UserProfileSkill } from 'src/user-profiles/models/user-profile-skill.model';
import { searchInColumnWhereOption } from 'src/utils/misc';
import { Skill } from './models';

@Injectable()
export class SkillsService {
  constructor(
    @InjectModel(Skill)
    private skillModel: typeof Skill
  ) {}

  /**
   * Find all skills with optional pagination and search functionality.
   * @param limit The maximum number of skills to return.
   * @param offset The number of skills to skip before starting to collect the result set.
   * @param search A search term to filter skills by name.
   * @returns A Promise that resolves to an array of skills.
   */
  async findAll(limit?: number, offset?: number, search = '') {
    const whereQuery = searchInColumnWhereOption('name', search);

    return this.skillModel.findAll({
      where: whereQuery,
      ...(limit ? { limit } : {}),
      ...(offset ? { offset } : {}),
      order: [['name', 'ASC']],
    });
  }

  /**
   * Find a skill by its name (case-insensitive).
   * @param name The name of the skill to find.
   * @returns A Promise that resolves to the found skill or null if not found.
   */
  async findOneByName(name: string): Promise<Skill | null> {
    return this.skillModel.findOne({
      where: {
        name: {
          [sequelize.Op.iLike]: name,
        },
      },
    });
  }

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
      attributes: ['id', 'name'],
      include: [
        {
          model: UserProfileSkill,
          as: 'userProfileSkills',
          where: { userProfileId },
          required: true,
          attributes: ['order'],
        },
      ],
      order: [
        [{ model: UserProfileSkill, as: 'userProfileSkills' }, 'order', 'ASC'],
      ],
    });
  }
}
