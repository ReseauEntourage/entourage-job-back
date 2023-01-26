import { Injectable } from '@nestjs/common';
import { InjectModel } from '@nestjs/sequelize';
import { QueryTypes, Transaction } from 'sequelize';
import { Contract } from 'src/common/contracts/models';
import { MailsService } from 'src/mails/mails.service';
import { UsersService } from 'src/users/users.service';
import { UpdateOpportunityUserDto } from './dto/update-opportunity-user.dto';
import { OpportunityUser } from './models';
import { OpportunityUserEvent } from './models/opportunity-user-event.model';
import { OpportunityCandidateInclude } from './models/opportunity.include';

@Injectable()
export class OpportunityUsersService {
  constructor(
    @InjectModel(OpportunityUser)
    private opportunityUserModel: typeof OpportunityUser,
    @InjectModel(OpportunityUserEvent)
    private opportunityUserEventModel: typeof OpportunityUserEvent,
    @InjectModel(Contract)
    private contractModel: typeof Contract,
    private usersService: UsersService,
    private mailsService: MailsService
  ) {}

  async createOrRestore(
    createOpportunityUserDto: Partial<OpportunityUser>,
    transaction?: Transaction
  ) {
    const transactionOption = transaction ? { transaction } : {};

    await this.opportunityUserModel.restore({
      where: {
        OpportunityId: createOpportunityUserDto.OpportunityId,
        UserId: createOpportunityUserDto.UserId,
      },
      ...transactionOption,
    });

    const opportunityUserModelToUpdate = await this.opportunityUserModel
      .findOrCreate({
        where: {
          OpportunityId: createOpportunityUserDto.OpportunityId,
          UserId: createOpportunityUserDto.UserId,
        },
        hooks: true,
        ...transactionOption,
      })
      .then((model) => {
        return model[0];
      });

    return opportunityUserModelToUpdate.update(
      createOpportunityUserDto,
      transactionOption
    );
  }

  async createOpportunityUserEvent(
    candidateId: string,
    opportunityId: string,
    createOpportunityUserEventDto: Partial<OpportunityUserEvent>
  ) {
    const opportunityUser = await this.findOneByCandidateIdAndOpportunityId(
      candidateId,
      opportunityId
    );

    const t = await this.opportunityUserEventModel.sequelize.transaction();

    try {
      const createdOpportunityUserEvent =
        await this.opportunityUserEventModel.create(
          {
            ...createOpportunityUserEventDto,
            OpportunityUserId: opportunityUser.id,
          },
          {
            hooks: true,
            transaction: t,
          }
        );

      if (createOpportunityUserEventDto.contract) {
        const contract = await this.contractModel.create(
          { name: createOpportunityUserEventDto.contract.name },
          {
            hooks: true,
            transaction: t,
          }
        );

        await createdOpportunityUserEvent.$set('contract', contract, {
          transaction: t,
        });
      }

      await t.commit();
      return this.opportunityUserEventModel.findByPk(
        createdOpportunityUserEvent.id,
        {
          include: {
            model: Contract,
            as: 'contract',
          },
        }
      );
    } catch (error) {
      await t.rollback();
      throw error;
    }
  }

  async findOneOpportunityUserEvent(id: string) {
    return this.opportunityUserEventModel.findByPk(id, {
      include: {
        model: Contract,
        as: 'contract',
      },
    });
  }

  async findOneByCandidateIdAndOpportunityId(
    candidateId: string,
    opportunityId: string
  ) {
    const candidate = await this.usersService.findOne(candidateId);

    if (!candidate) {
      return null;
    }

    return this.opportunityUserModel.findOne({
      where: {
        UserId: candidateId,
        OpportunityId: opportunityId,
      },
      include: OpportunityCandidateInclude,
    });
  }

  async findAllByCandidateId(candidateId: string) {
    const candidate = await this.usersService.findOne(candidateId);

    if (!candidate) {
      return null;
    }

    return this.opportunityUserModel.findAll({
      where: {
        UserId: candidateId,
      },
    });
  }

  async findAllByOpportunityId(opportunityId: string) {
    return this.opportunityUserModel.findAll({
      where: {
        OpportunityId: opportunityId,
      },
      include: OpportunityCandidateInclude,
    });
  }

  async findAllByCandidatesIdsAndOpportunityId(
    candidatesIds: string[],
    opportunityId: string
  ) {
    return this.opportunityUserModel.findAll({
      where: {
        UserId: candidatesIds,
        OpportunityId: opportunityId,
      },
      include: OpportunityCandidateInclude,
    });
  }

  async updateByCandidateId(
    candidateId: string,
    updateOpportunityUserDto: UpdateOpportunityUserDto
  ) {
    const candidate = await this.usersService.findOne(candidateId);

    if (!candidate) {
      return null;
    }

    await this.opportunityUserModel.update(updateOpportunityUserDto, {
      where: {
        UserId: candidateId,
      },
      individualHooks: true,
    });

    return this.findAllByCandidateId(candidateId);
  }

  async updateByCandidateIdAndOpportunityId(
    candidateId: string,
    opportunityId: string,
    updateOpportunityUserDto: UpdateOpportunityUserDto
  ) {
    const candidate = await this.usersService.findOne(candidateId);

    if (!candidate) {
      return null;
    }

    await this.opportunityUserModel.update(updateOpportunityUserDto, {
      where: {
        UserId: candidateId,
        OpportunityId: opportunityId,
      },
      individualHooks: true,
    });

    return this.findOneByCandidateIdAndOpportunityId(
      candidateId,
      opportunityId
    );
  }

  async findOrCreateByCandidateIdAndOpportunityId(
    candidateId: string,
    opportunityId: string,
    findOrCreateOpportunityUserDto: UpdateOpportunityUserDto = {} as UpdateOpportunityUserDto
  ) {
    const [opportunityUser] = await this.opportunityUserModel.findOrCreate({
      where: {
        OpportunityId: opportunityId,
        UserId: candidateId,
        ...findOrCreateOpportunityUserDto,
      },
      hooks: true,
    });
    return opportunityUser;
  }

  async countOffersByStatus(candidateId: string) {
    const statusCounts = await this.opportunityUserModel.sequelize.query(
      `SELECT status, count(*)
       FROM "Opportunity_Users"
                LEFT JOIN "Opportunities" ON "Opportunities"."id" = "Opportunity_Users"."OpportunityId"
       WHERE "Opportunity_Users"."UserId" = :candidateId
         AND (("status" = -1 AND ("recommended" = true OR "bookmarked" = true))
           OR status IN (0, 1, 2, 3, 4))
         AND "Opportunities"."isValidated" = true
         AND "Opportunities"."isArchived" = false
         AND "Opportunity_Users"."archived" = false
       GROUP BY "status";`,
      {
        replacements: { candidateId },
        type: QueryTypes.SELECT,
      }
    );
    const archivedOppUs = await this.opportunityUserModel.findAll({
      where: {
        UserId: candidateId,
        archived: true,
      },
    });

    return [
      {
        status: 'archived',
        count: archivedOppUs.length,
      },
      ...statusCounts,
    ];
  }
}
