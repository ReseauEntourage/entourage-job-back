import { Injectable } from '@nestjs/common';
import { InjectModel } from '@nestjs/sequelize';
import { OpportunityUser } from 'src/opportunities/models';
import { OpportunityUserEvent } from 'src/opportunities/models/opportunity-user-event.model';

@Injectable()
export class OpportunityUsersHelper {
  constructor(
    @InjectModel(OpportunityUser)
    private opportunityUserModel: typeof OpportunityUser,
    @InjectModel(OpportunityUserEvent)
    private opportunityUserEventModel: typeof OpportunityUserEvent
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

  async createOpportunityUserEvent(
    opportunityUserId: string,
    props: Partial<OpportunityUserEvent> = {}
  ): Promise<OpportunityUser> {
    const opportunityUserEvent = await this.opportunityUserEventModel.create(
      {
        OpportunityUserId: opportunityUserId,
        ...props,
      },
      { hooks: true }
    );
    return opportunityUserEvent.toJSON();
  }
}
