import { Injectable } from '@nestjs/common';
import { InjectModel } from '@nestjs/sequelize';
import sequelize, { Op } from 'sequelize';
import { Skill } from 'src/skills/models';
import { UserProfile } from 'src/user-profiles/models';
import { UserProfileSkill } from 'src/user-profiles/models/user-profile-skill.model';

@Injectable()
export class UserProfileSkillsService {
  constructor(
    @InjectModel(Skill)
    private skillModel: typeof Skill,
    @InjectModel(UserProfileSkill)
    private userProfileSkillModel: typeof UserProfileSkill
  ) {}

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

  async updateSkillsByUserProfileId(
    userProfileToUpdate: UserProfile,
    skills: Partial<Skill>[],
    t: sequelize.Transaction
  ): Promise<void> {
    const skillsData = await Promise.all(
      skills.map(async (skill, order) => {
        const existingSkill = await this.skillModel.findOne({
          where: { name: { [Op.iLike]: skill.name } },
        });

        if (existingSkill) {
          return {
            userProfileId: userProfileToUpdate.id,
            skillId: existingSkill.id,
            order,
          };
        }

        const newSkill = await this.skillModel.create(
          {
            name: skill.name,
          },
          {
            hooks: true,
            transaction: t,
          }
        );

        return {
          userProfileId: userProfileToUpdate.id,
          skillId: newSkill.id,
          order,
        };
      })
    );

    // Remove the user profile skills that don't exist anymore
    await this.userProfileSkillModel.destroy({
      where: {
        userProfileId: userProfileToUpdate.id,
        skillId: {
          [Op.notIn]: skillsData.map((skillData) => skillData.skillId),
        },
      },
      individualHooks: true,
      transaction: t,
    });

    // Create or update userProfileSkill (and update order)
    await Promise.all(
      skillsData.map(async (skillData) => {
        const existingUserProfileSkill =
          await this.userProfileSkillModel.findOne({
            where: {
              userProfileId: userProfileToUpdate.id,
              skillId: skillData.skillId,
            },
          });

        if (existingUserProfileSkill) {
          return existingUserProfileSkill.update(
            { order: skillData.order },
            {
              hooks: true,
              transaction: t,
            }
          );
        }

        return this.userProfileSkillModel.create(skillData, {
          hooks: true,
          transaction: t,
        });
      })
    );
  }
}
