import { Injectable } from '@nestjs/common';
import { InjectModel } from '@nestjs/sequelize';
import { QueryTypes } from 'sequelize';
import { MailsService } from 'src/mails/mails.service';
import { UsersService } from 'src/users/users.service';
import { UpdateOpportunityUserDto } from './dto/update-opportunity-user.dto';
import { OpportunityUser } from './models';
import { OpportunityCandidateInclude } from './models/opportunity.include';

@Injectable()
export class OpportunityUsersService {
  constructor(
    @InjectModel(OpportunityUser)
    private opportunityUserModel: typeof OpportunityUser,
    private usersService: UsersService,
    private mailsService: MailsService
  ) {}

  async create(createOpportunityUserDto: Partial<OpportunityUser>) {
    return this.opportunityUserModel.create(createOpportunityUserDto, {
      hooks: true,
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
        LEFT JOIN "Opportunities" ON "Opportunities" . "id" = "Opportunity_Users" . "OpportunityId"
        WHERE "Opportunity_Users" . "UserId"=:candidateId 
        AND (("status"=-1 AND ("recommended"=true OR "bookmarked"=true)) 
            OR status IN (0,1,2,3,4))
        AND "Opportunities" . "isValidated"=true
        AND "Opportunities" . "isArchived"=false
        AND "Opportunity_Users" . "archived"=false
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
