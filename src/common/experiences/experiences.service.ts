import { Injectable } from '@nestjs/common';
import { InjectModel } from '@nestjs/sequelize';
import sequelize, { Op } from 'sequelize';
import { Skill } from '../skills/models';
import { SkillsService } from '../skills/skills.service';
import { UserProfile } from 'src/user-profiles/models';
import { Experience, ExperienceSkill } from './models';

@Injectable()
export class ExperiencesService {
  constructor(
    @InjectModel(Experience)
    private experienceModel: typeof Experience,
    @InjectModel(ExperienceSkill)
    private experienceSkillModel: typeof ExperienceSkill,
    private skillsService: SkillsService
  ) {}

  async updateExperiencesForUserProfile(
    userProfileToUpdate: UserProfile,
    experiences: Partial<Experience>[],
    transaction?: sequelize.Transaction
  ) {
    // Fetch existing experiences for the user profile
    const existingExperiences = await userProfileToUpdate.$get('experiences', {
      transaction,
    });

    const existingExperiencesMap = new Map(
      existingExperiences.map((exp) => [exp.id, exp])
    );

    const experiencesToKeep: Experience[] = [];
    for (const experienceInput of experiences) {
      let experience: Experience;

      if (
        experienceInput.id &&
        existingExperiencesMap.has(experienceInput.id)
      ) {
        // Update an existing experience
        experience = existingExperiencesMap.get(experienceInput.id);
        await experience.update(
          {
            title: experienceInput.title,
            location: experienceInput.location,
            company: experienceInput.company,
            startDate: experienceInput.startDate,
            endDate: experienceInput.endDate,
            description: experienceInput.description,
          },
          { transaction }
        );
      } else {
        // Création d'une nouvelle expérience
        experience = await this.experienceModel.create(
          {
            ...experienceInput,
            userProfileId: userProfileToUpdate.id,
          },
          { transaction }
        );
      }
      experiencesToKeep.push(experience);

      // Update skills for the experience
      await this.updateSkillsForExperience(
        experience,
        experienceInput.skills,
        transaction
      );
    }

    // Delete experiences that are not in the new list
    await this.experienceModel.destroy({
      where: {
        userProfileId: userProfileToUpdate.id,
        id: {
          [Op.notIn]: experiencesToKeep.map((e) => e.id),
        },
      },
      transaction,
    });
  }

  private async updateSkillsForExperience(
    experience: Experience,
    skills: Partial<Skill>[],
    transaction?: sequelize.Transaction
  ) {
    // Delete existing skills for the experience
    await this.experienceSkillModel.destroy({
      where: {
        experienceId: experience.id,
      },
      transaction,
    });

    // Add new skills for the experience
    if (skills && skills.length > 0) {
      const skillsToAdd = await this.skillsService.bulkCreateSkills(
        skills.map((skill) => ({
          name: skill.name,
          userProfileId: experience.userProfileId,
          order: -1, // Default order to -1 for new skills that is defined through experience skills
        })),
        transaction
      );
      const experienceSkillsPromises = skillsToAdd.map((skill, index) =>
        experience.$add('skills', skill, {
          transaction,
          through: {
            order: index,
          },
        })
      );
      await Promise.all(experienceSkillsPromises);
    }
  }

  async findByUserProfileId(userProfileId: string) {
    return this.experienceModel.findAll({
      where: { userProfileId },
      attributes: [
        'id',
        'title',
        'company',
        'description',
        'location',
        'startDate',
        'endDate',
      ],
      include: [
        {
          model: Skill,
          as: 'skills',
          attributes: ['id', 'name'],
          through: { attributes: ['order'], as: 'experienceSkills' },
        },
      ],
      order: [['startDate', 'DESC']],
    });
  }
}
