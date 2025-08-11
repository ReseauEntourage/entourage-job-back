import { Injectable, NotFoundException } from '@nestjs/common';
import { InjectModel } from '@nestjs/sequelize';
import sequelize, { Op, Transaction } from 'sequelize';
import { Sequelize } from 'sequelize-typescript';
import { FilterConstant } from 'src/utils/types/Filters';

import { CreateRecruitementAlertDto } from './dto';
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
    private sequelize: Sequelize
  ) {}

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

  async findOne(recruitementAlertId: string) {
    return this.recruitementAlertModel.findOne({
      where: { id: recruitementAlertId },
    });
  }

  async updateBusinessSectors(
    recruitementAlertId: string,
    businessSectorIds: string[],
    transaction?: Transaction
  ) {
    // Find the recruitement alert - use the transaction for this query!
    const recruitementAlert = await this.recruitementAlertModel.findOne({
      where: { id: recruitementAlertId },
      transaction,
    });

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
    const recruitementAlert = await this.recruitementAlertModel.findOne({
      where: { id: recruitementAlertId },
      transaction, // Pass the transaction here to see newly created records!
    });

    if (!recruitementAlert) {
      throw new NotFoundException(
        `Recruitement alert with ID ${recruitementAlertId} not found`
      );
    }

    // Use provided transaction or create a new one
    const t = transaction || (await this.sequelize.transaction());

    try {
      // save recruitement alert skills
      const skillsToCreate = skills.map((skill) => ({
        recruitementAlertId,
        skillId: skill.value,
      }));

      await this.recruitementAlertSkillModel.bulkCreate(skillsToCreate, {
        transaction: t,
      });

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
}
