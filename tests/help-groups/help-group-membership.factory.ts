import { Injectable } from '@nestjs/common';
import { InjectModel } from '@nestjs/sequelize';
import { HelpGroupMembership } from 'src/help-groups/models';
import { Factory } from 'src/utils/types';

@Injectable()
export class HelpGroupMembershipFactory implements Factory<HelpGroupMembership> {
  constructor(
    @InjectModel(HelpGroupMembership)
    private helpGroupMembershipModel: typeof HelpGroupMembership
  ) {}

  async create(
    props: Partial<HelpGroupMembership> &
      Pick<HelpGroupMembership, 'groupId' | 'userId'>
  ): Promise<HelpGroupMembership> {
    const membership = await this.helpGroupMembershipModel.create({
      charterAcceptedAt: new Date(),
      leftAt: null,
      ...props,
    });
    return membership.toJSON();
  }
}
