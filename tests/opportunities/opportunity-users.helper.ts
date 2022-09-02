import { Injectable } from '@nestjs/common';
import { InjectModel } from '@nestjs/sequelize';
import { OpportunityUser } from 'src/opportunities/models';

@Injectable()
export class OpportunityUsersHelper {
  constructor(
    @InjectModel(OpportunityUser)
    private opportunityUserModel: typeof OpportunityUser
  ) {}

  async associateOpportunityUser(
    opportunityId: string,
    candidateId: string,
    props = {}
  ) {
    return this.opportunityUserModel.create({
      OpportunityId: opportunityId,
      UserId: candidateId,
      ...props,
    });
  }

  async associateManyOpportunityUsers(
    opportunityIds: string[],
    candidateId: string
  ) {
    return Promise.all(
      opportunityIds.map((opportunityId) => {
        return this.associateOpportunityUser(opportunityId, candidateId);
      })
    );
  }
}
