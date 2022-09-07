import { Injectable } from '@nestjs/common';
import { InjectModel } from '@nestjs/sequelize';
import { Opportunity, OpportunityUser } from './models';
import { OpportunityCandidateInclude } from './models/opportunity.include';

@Injectable()
export class OpportunityUsersService {
  constructor(
    @InjectModel(OpportunityUser)
    private opportunityUserModel: typeof OpportunityUser
  ) {}

  create(createOpportunityUserDto: Partial<OpportunityUser>) {
    return this.opportunityUserModel.create(createOpportunityUserDto, {
      hooks: true,
    });
  }

  findOneByCandidateIdAndOpportunityId(
    candidateId: string,
    opportunityId: string
  ) {
    return this.opportunityUserModel.findOne({
      where: {
        UserId: candidateId,
        OpportunityId: opportunityId,
      },
      include: OpportunityCandidateInclude,
    });
  }

  findAllByCandidateIdsAndOpportunityId(
    candidateIds: string[],
    opportunityId: string
  ) {
    return this.opportunityUserModel.findAll({
      where: {
        UserId: candidateIds,
        OpportunityId: opportunityId,
      },
      include: OpportunityCandidateInclude,
    });
  }
}
