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
    props: Partial<OpportunityUser> = {}
  ): Promise<OpportunityUser> {
    const opportunityUser = await this.opportunityUserModel.create(
      {
        OpportunityId: opportunityId,
        UserId: candidateId,
        ...props,
      },
      { hooks: true }
    );
    return opportunityUser.toJSON();
  }

  async associateManyOpportunityUsers(
    opportunitiesIds: string[],
    candidateId: string,
    props: Partial<OpportunityUser> = {}
  ) {
    return Promise.all(
      opportunitiesIds.map((opportunityId) => {
        return this.associateOpportunityUser(opportunityId, candidateId, props);
      })
    );
  }
}
