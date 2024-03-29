import { Injectable } from '@nestjs/common';
import { InjectModel } from '@nestjs/sequelize';
import _ from 'lodash';
import { Op, QueryTypes, Transaction } from 'sequelize';
import { Contract } from 'src/common/contracts/models';
import { ExternalDatabasesService } from 'src/external-databases/external-databases.service';
import { User } from 'src/users/models';
import { UsersService } from 'src/users/users.service';
import { UpdateOpportunityUserDto, UpdateOpportunityUserEventDto } from './dto';
import { Opportunity, OpportunityUser } from './models';
import { OpportunityUserEvent } from './models/opportunity-user-event.model';
import { OpportunityCandidateInclude } from './models/opportunity.include';
import { EventTypes } from './opportunities.types';

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
    private externalDatabasesService: ExternalDatabasesService
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

    let createdOpportunityUserEventId: string;

    try {
      ({ id: createdOpportunityUserEventId } =
        await this.opportunityUserEventModel.sequelize.transaction(
          async (t) => {
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

            return createdOpportunityUserEvent;
          }
        ));
    } catch (error) {
      throw error;
    }

    return this.findOneOpportunityUserEvent(createdOpportunityUserEventId);
  }

  async createOrUpdateExternalDBEvent(opportunityUserEventId: string) {
    return this.externalDatabasesService.createOrUpdateExternalDBEvent(
      opportunityUserEventId
    );
  }

  async findOneOpportunityUserEvent(id: string) {
    return this.opportunityUserEventModel.findByPk(id, {
      include: [
        {
          model: Contract,
          as: 'contract',
        },
      ],
    });
  }

  async findOneOpportunityUserEventComplete(id: string) {
    return this.opportunityUserEventModel.findByPk(id, {
      include: [
        {
          model: Contract,
          as: 'contract',
        },
        {
          model: OpportunityUser,
          as: 'opportunityUser',
          include: [
            { model: Opportunity, as: 'opportunity' },
            { model: User, as: 'user' },
          ],
        },
      ],
    });
  }

  async findOne(id: string) {
    return this.opportunityUserModel.findByPk(id, {
      include: OpportunityCandidateInclude,
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

  async findAllOpportunityUserEventIds() {
    return this.opportunityUserEventModel.findAll({
      attributes: ['id'],
      where: {
        type: {
          [Op.or]: [EventTypes.INTERVIEW, EventTypes.HIRING],
        },
      },
    });
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

  async updateOpportunityUserEvent(
    id: string,
    updateOpportunityUserEventDto: UpdateOpportunityUserEventDto
  ) {
    try {
      await this.opportunityUserEventModel.sequelize.transaction(async (t) => {
        const { contract: contractDto, ...restUpdateOpportunityUserEventDto } =
          updateOpportunityUserEventDto;

        let contractObject = {};
        if (_.isNull(contractDto)) {
          contractObject = { ContractId: null };
        } else if (contractDto) {
          const { id: contractId } = await this.contractModel.create(
            {
              name: contractDto.name,
              OpportunityUserId: id,
            },
            {
              hooks: true,
              transaction: t,
            }
          );
          contractObject = { ContractId: contractId };
        }

        await this.opportunityUserEventModel.update(
          { ...restUpdateOpportunityUserEventDto, ...contractObject },
          {
            where: { id },
            individualHooks: true,
            transaction: t,
          }
        );
      });
    } catch (error) {
      throw error;
    }

    return this.findOneOpportunityUserEvent(id);
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

  async candidateCountOffersByStatus(candidateId: string) {
    const statusCounts = await this.opportunityUserModel.sequelize.query(
      `SELECT status, count(*)
       FROM "Opportunity_Users"
                LEFT JOIN "Opportunities" ON "Opportunities"."id" = "Opportunity_Users"."OpportunityId"
       WHERE "Opportunity_Users"."UserId" = :candidateId
         AND (("status" = -1 AND
               (("Opportunities"."isPublic" = false) OR ("recommended" = true OR "bookmarked" = true)))
           OR status IN (0, 1, 2, 3, 4))
         AND "Opportunities"."isValidated" = true
         AND "Opportunities"."isArchived" = false
         AND "Opportunity_Users"."archived" = false
         AND "Opportunity_Users"."deletedAt" is null
       GROUP BY "status";`,
      {
        replacements: { candidateId },
        type: QueryTypes.SELECT,
      }
    );
    const archivedOppUsCount: { count: number }[] =
      await this.opportunityUserModel.sequelize.query(
        `SELECT count(*)
         FROM "Opportunity_Users"
                  LEFT JOIN "Opportunities" ON "Opportunities"."id" = "Opportunity_Users"."OpportunityId"
         WHERE "Opportunity_Users"."UserId" = :candidateId
           AND "Opportunities"."isValidated" = true
           AND "Opportunities"."isArchived" = false
           AND "Opportunity_Users"."archived" = true
           AND "Opportunity_Users"."deletedAt" is null`,
        {
          replacements: { candidateId },
          type: QueryTypes.SELECT,
        }
      );

    return [
      {
        status: 'archived',
        count: archivedOppUsCount[0].count,
      },
      ...statusCounts,
    ];
  }

  async refreshSalesforceEvents(opportunityUserEventsIds: string[]) {
    return this.externalDatabasesService.refreshSalesforceEvents(
      opportunityUserEventsIds
    );
  }
}
