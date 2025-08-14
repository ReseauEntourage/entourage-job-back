import { Injectable, NotFoundException } from '@nestjs/common';
import { InjectModel } from '@nestjs/sequelize';
import sequelize, { Op, Transaction } from 'sequelize';
import { Sequelize } from 'sequelize-typescript';
import { Skill } from 'src/common/skills/models';
import { SkillsService } from 'src/common/skills/skills.service';
import { CompanyUser } from 'src/companies/models/company-user.model';
import { UserProfilesService } from 'src/user-profiles/user-profiles.service';
import { FilterConstant } from 'src/utils/types/Filters';
import { CreateRecruitementAlertDto, UpdateRecruitementAlertDto } from './dto';
import {
  RecruitementAlert,
  RecruitementAlertBusinessSector,
  RecruitementAlertSkill,
} from './models';

@Injectable()
export class RecruitementAlertsService {
  constructor(
    @InjectModel(RecruitementAlert)
    private recruitementAlertModel: typeof RecruitementAlert,
    @InjectModel(RecruitementAlertBusinessSector)
    private recruitementAlertBusinessSectorModel: typeof RecruitementAlertBusinessSector,
    @InjectModel(RecruitementAlertSkill)
    private recruitementAlertSkillModel: typeof RecruitementAlertSkill,
    @InjectModel(CompanyUser)
    private companyUserModel: typeof CompanyUser,
    @InjectModel(Skill)
    private skillModel: typeof Skill,
    private sequelize: Sequelize,
    private userProfilesService: UserProfilesService,
    private skillsService: SkillsService
  ) {}

  async findAllByUserId(userId: string): Promise<RecruitementAlert[]> {
    // Find company with userId
    const companyUser = await this.companyUserModel.findOne({
      where: { userId },
      attributes: ['companyId'],
    });

    if (!companyUser) {
      return [];
    }

    const companyId = companyUser.companyId;

    // Fetch all recruitement alerts for the company
    const recruitementAlerts = await this.recruitementAlertModel.findAll({
      where: {
        companyId,
      },
      include: [
        {
          association: 'businessSectors',
        },
        {
          association: 'skills',
        },
        {
          association: 'company',
        },
      ],
    });

    return recruitementAlerts;
  }

  async create(createRecruitementAlertDto: CreateRecruitementAlertDto) {
    const { businessSectorIds, skills, ...recruitementAlertData } =
      createRecruitementAlertDto;

    const result = await this.sequelize.transaction(async (transaction) => {
      // Create the recruitement alert
      const recruitementAlert = await this.recruitementAlertModel.create(
        recruitementAlertData,
        { transaction }
      );
      // update business sectors
      if (businessSectorIds && businessSectorIds.length > 0) {
        await this.updateBusinessSectors(
          recruitementAlert.id,
          businessSectorIds,
          transaction
        );
      }
      // update skills
      if (skills && skills.length > 0) {
        await this.updateSkills(recruitementAlert.id, skills, transaction);
      }

      return recruitementAlert;
    });

    return result;
  }

  async findOne(recruitementAlertId: string, transaction?: Transaction) {
    return this.recruitementAlertModel.findOne({
      where: { id: recruitementAlertId },
      include: [
        {
          association: 'businessSectors',
        },
        {
          association: 'skills',
        },
        {
          association: 'company',
        },
      ],
      transaction,
    });
  }

  async update(
    recruitementAlertId: string,
    updateRecruitementAlertDto: UpdateRecruitementAlertDto
  ) {
    const { businessSectorIds, skills, ...recruitementAlertData } =
      updateRecruitementAlertDto;

    return this.sequelize.transaction(async (transaction) => {
      const recruitementAlert = await this.findOne(
        recruitementAlertId,
        transaction
      );

      if (!recruitementAlert) {
        throw new NotFoundException(
          `Recruitement alert with ID ${recruitementAlertId} not found`
        );
      }

      // Mettre à jour les données de base de l'alerte
      if (Object.keys(recruitementAlertData).length > 0) {
        await recruitementAlert.update(recruitementAlertData, { transaction });
      }

      if (businessSectorIds) {
        await this.updateBusinessSectors(
          recruitementAlertId,
          businessSectorIds,
          transaction
        );
      }

      if (skills) {
        await this.updateSkills(recruitementAlertId, skills, transaction);
      }

      return this.findOne(recruitementAlertId, transaction);
    });
  }

  async updateBusinessSectors(
    recruitementAlertId: string,
    businessSectorIds: string[],
    transaction?: Transaction
  ) {
    // Find the recruitement alert - use the transaction for this query!
    const recruitementAlert = await this.findOne(
      recruitementAlertId,
      transaction
    );

    if (!recruitementAlert) {
      console.error('Recruitement alert not found');
      throw new NotFoundException(
        `Recruitement alert with ID ${recruitementAlertId} not found`
      );
    }

    // Use provided transaction or create a new one
    const t = transaction || (await this.sequelize.transaction());

    try {
      // Get current business sectors
      const currentBusinessSectors =
        await this.recruitementAlertBusinessSectorModel.findAll({
          where: { recruitementAlertId },
          transaction: t,
        });

      // Get current business sector IDs
      const currentBusinessSectorIds = currentBusinessSectors.map(
        (bs) => bs.businessSectorId
      );

      // Identify business sectors to create
      const businessSectorsToCreate = businessSectorIds
        .filter((id) => !currentBusinessSectorIds.includes(id))
        .map((businessSectorId) => ({
          recruitementAlertId,
          businessSectorId,
        }));

      // Identify business sectors to delete
      const businessSectorIdsToDelete = currentBusinessSectors
        .filter(
          (currentBs) => !businessSectorIds.includes(currentBs.businessSectorId)
        )
        .map((bs) => bs.id);

      // Delete business sectors that are no longer needed
      if (businessSectorIdsToDelete.length > 0) {
        await this.recruitementAlertBusinessSectorModel.destroy({
          where: {
            id: {
              [Op.in]: businessSectorIdsToDelete,
            },
          },
          transaction: t,
        });
      }

      // Create new business sectors
      if (businessSectorsToCreate.length > 0) {
        await this.recruitementAlertBusinessSectorModel.bulkCreate(
          businessSectorsToCreate,
          { transaction: t }
        );
      }

      // If we created our own transaction, commit it
      if (!transaction) {
        await t.commit();
      }

      return true;
    } catch (error) {
      console.error(error);
      // If we created our own transaction, roll it back
      if (!transaction) {
        await t.rollback();
      }
      throw error;
    }
  }

  async updateSkills(
    recruitementAlertId: string,
    skills: FilterConstant<string>[],
    transaction?: sequelize.Transaction
  ) {
    // Find the recruitement alert
    const recruitementAlert = await this.findOne(
      recruitementAlertId,
      transaction
    );

    if (!recruitementAlert) {
      throw new NotFoundException(
        `Recruitement alert with ID ${recruitementAlertId} not found`
      );
    }

    // Use provided transaction or create a new one
    const t = transaction || (await this.sequelize.transaction());

    try {
      // First, check if there are any new skills to create
      const newSkills = skills.filter((skill) => skill.__isNew__ === true);
      let createdSkills: Skill[] = [];

      if (newSkills.length > 0) {
        // Create the new skills in the database
        const skillsToCreate = newSkills.map((skill) => ({
          name: skill.label,
        }));

        createdSkills = await this.skillsService.bulkCreateSkills(
          skillsToCreate,
          t
        );
      }

      // Get current skills
      const currentSkills = await this.recruitementAlertSkillModel.findAll({
        where: { recruitementAlertId },
        transaction: t,
      });

      // Get current skill IDs
      const currentSkillIds = currentSkills.map((s) => s.skillId);

      // Prepare skills to create
      const skillsToCreate = skills.map((skill) => {
        // If this is a new skill, find its newly created ID
        if (skill.__isNew__ === true) {
          const createdSkill = createdSkills.find(
            (cs) => cs.name === skill.label
          );
          if (createdSkill) {
            return {
              recruitementAlertId,
              skillId: createdSkill.id,
            };
          }
        }

        return {
          recruitementAlertId,
          skillId: skill.value,
        };
      });

      // First delete all existing skills
      if (currentSkillIds.length > 0) {
        await this.recruitementAlertSkillModel.destroy({
          where: {
            recruitementAlertId,
          },
          transaction: t,
        });
      }

      // Then create all skills
      if (skillsToCreate.length > 0) {
        await this.recruitementAlertSkillModel.bulkCreate(skillsToCreate, {
          transaction: t,
        });
      }

      // If we created our own transaction, commit it
      if (!transaction) {
        await t.commit();
      }

      return true;
    } catch (error) {
      // If we created our own transaction, roll it back
      if (!transaction) {
        await t.rollback();
      }
      throw error;
    }
  }

  async getRecruitementAlertMatching(recruitementAlertId: string) {
    const recruitementAlert = await this.findOne(recruitementAlertId);

    if (!recruitementAlert) {
      throw new NotFoundException(
        `Recruitement alert with ID ${recruitementAlertId} not found`
      );
    }

    // Utilisation de la nouvelle méthode spécifique pour trouver les profils correspondants
    const matchingProfiles =
      await this.userProfilesService.findMatchingProfilesForRecruitementAlert(
        recruitementAlert
      );

    return matchingProfiles;
  }

  async delete(recruitementAlertId: string): Promise<boolean> {
    const recruitementAlert = await this.findOne(recruitementAlertId);

    if (!recruitementAlert) {
      throw new NotFoundException(
        `Recruitement alert with ID ${recruitementAlertId} not found`
      );
    }

    return this.sequelize.transaction(async (transaction) => {
      await this.recruitementAlertBusinessSectorModel.destroy({
        where: { recruitementAlertId },
        transaction,
      });

      await this.recruitementAlertSkillModel.destroy({
        where: { recruitementAlertId },
        transaction,
      });

      await recruitementAlert.destroy({ transaction });

      return true;
    });
  }
}
