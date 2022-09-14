import { Injectable } from '@nestjs/common';
import { InjectModel } from '@nestjs/sequelize';
import { UpdateOpportunityUserDto } from './dto/update-opportunity-user.dto';
import { OpportunityUser } from './models';
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

  async findOneByCandidateIdAndOpportunityId(
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

  async findAllByCandidateId(candidateId: string) {
    return this.opportunityUserModel.findAll({
      where: {
        UserId: candidateId,
      },
    });
  }

  async findAllByCandidateIdsAndOpportunityId(
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

  async updateByCandidateId(
    candidateId: string,
    updateOpportunityUserDto: UpdateOpportunityUserDto
  ) {
    return this.opportunityUserModel.update(updateOpportunityUserDto, {
      where: {
        UserId: candidateId,
      },
    });
  }
}
