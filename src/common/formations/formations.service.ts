import { Injectable } from '@nestjs/common';
import { InjectModel } from '@nestjs/sequelize';
import sequelize, { Op } from 'sequelize';
import { Skill } from '../skills/models';
import { SkillsService } from '../skills/skills.service';
import { UserProfile } from 'src/user-profiles/models';
import { Formation, FormationSkill } from './models';

@Injectable()
export class FormationsService {
  constructor(
    @InjectModel(Formation)
    private formationModel: typeof Formation,
    @InjectModel(FormationSkill)
    private formationSkillModel: typeof FormationSkill,
    private skillsService: SkillsService
  ) {}

  async updateFormationsForUserProfile(
    userProfileToUpdate: UserProfile,
    formations: Partial<Formation>[],
    transaction?: sequelize.Transaction
  ) {
    // Fetch existing formations for the user profile
    const existingFormations = await userProfileToUpdate.$get('formations', {
      transaction,
    });

    const existingFormationsMap = new Map(
      existingFormations.map((formation) => [formation.id, formation])
    );

    const formationsToKeep: Formation[] = [];
    for (const formationInput of formations) {
      let formation: Formation;

      if (formationInput.id && existingFormationsMap.has(formationInput.id)) {
        // Update an existing formation
        formation = existingFormationsMap.get(formationInput.id);
        await formation.update(
          {
            title: formationInput.title,
            location: formationInput.location,
            institution: formationInput.institution,
            startDate: formationInput.startDate,
            endDate: formationInput.endDate,
            description: formationInput.description,
          },
          { transaction }
        );
      } else {
        // Création d'une nouvelle expérience
        formation = await this.formationModel.create(
          {
            ...formationInput,
            userProfileId: userProfileToUpdate.id,
          },
          { transaction }
        );
      }
      formationsToKeep.push(formation);

      // Update skills for the formation
      await this.updateSkillsForFormation(
        formation,
        formationInput.skills,
        transaction
      );
    }

    // Delete formations that are not in the new list
    await this.formationModel.destroy({
      where: {
        userProfileId: userProfileToUpdate.id,
        id: {
          [Op.notIn]: formationsToKeep.map((e) => e.id),
        },
      },
      transaction,
    });
  }

  private async updateSkillsForFormation(
    formation: Formation,
    skills: Partial<Skill>[],
    transaction?: sequelize.Transaction
  ) {
    // Delete existing skills for the formation
    await this.formationSkillModel.destroy({
      where: {
        formationId: formation.id,
      },
      transaction,
    });

    // Add new skills for the formation
    if (skills && skills.length > 0) {
      const skillsToAdd = await this.skillsService.bulkCreateSkills(
        skills.map((skill) => ({
          name: skill.name,
          userProfileId: formation.userProfileId,
          order: -1, // Default order to -1 for new skills that is defined through formation skills
        })),
        transaction
      );
      const formationSkillsPromises = skillsToAdd.map((skill, index) =>
        formation.$add('skills', skill, {
          transaction,
          through: {
            order: index,
          },
        })
      );
      await Promise.all(formationSkillsPromises);
    }
  }
}
