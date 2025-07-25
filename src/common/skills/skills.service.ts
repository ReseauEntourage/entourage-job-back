import { Injectable } from '@nestjs/common';
import { InjectModel } from '@nestjs/sequelize';
import sequelize from 'sequelize';
import { UserProfileSkill } from 'src/user-profiles/models/user-profile-skill.model';
import { Skill } from './models';

@Injectable()
export class SkillsService {
  constructor(
    @InjectModel(Skill)
    private skillModel: typeof Skill
  ) {}

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
