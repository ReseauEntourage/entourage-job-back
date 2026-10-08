import {
  ForbiddenException,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import { InjectModel } from '@nestjs/sequelize';
import { Op, Transaction } from 'sequelize';
import { User } from 'src/users/models';
import { isEntourageAdmin } from 'src/users/users.utils';
import {
  HelpGroupErrorCodes,
  HelpGroupViewerPermissions,
  HelpGroupViewerStates,
} from './help-groups.types';
import { HelpGroup, HelpGroupMembership } from './models';

const writerAttributes = [
  'id',
  'firstName',
  'lastName',
  'email',
  'role',
  'zone',
  'elearningCompletedAt',
  'helpGroupsCharterAcceptedAt',
];

export interface HelpGroupWriteContext {
  group: HelpGroup;
  membership: HelpGroupMembership;
  user: User;
}

/**
 * Single write control of the help groups, applied by the back to every
 * write action whatever the front displays:
 * 1. the group is published and not deleted, otherwise 404 (an admin cannot
 *    write in an unpublished group it previews);
 * 2. the user has an active membership, otherwise 403 `HELP_GROUP_NOT_MEMBER`;
 * 3. the user completed the eLearning, otherwise 403
 *    `ELEARNING_NOT_COMPLETED`. Entourage admins are exempted from this
 *    condition, not from the membership one.
 * Editing or deleting one's own content only checks the authorship.
 */
@Injectable()
export class HelpGroupsWriteGuardService {
  constructor(
    @InjectModel(HelpGroup)
    private helpGroupModel: typeof HelpGroup,
    @InjectModel(HelpGroupMembership)
    private helpGroupMembershipModel: typeof HelpGroupMembership,
    @InjectModel(User)
    private userModel: typeof User
  ) {}

  async findWriter(userId: string, transaction?: Transaction): Promise<User> {
    const user = await this.userModel.findByPk(userId, {
      attributes: writerAttributes,
      transaction,
    });
    if (!user) {
      throw new NotFoundException();
    }
    return user;
  }

  /**
   * Published and non deleted group, for every role.
   */
  async findPublishedGroupBySlug(slug: string): Promise<HelpGroup> {
    const group = await this.helpGroupModel.findOne({
      where: { slug, publishedAt: { [Op.ne]: null } },
    });
    if (!group) {
      throw new NotFoundException();
    }
    return group;
  }

  async findActiveMembership(
    groupId: string,
    userId: string,
    transaction?: Transaction
  ): Promise<HelpGroupMembership | null> {
    return this.helpGroupMembershipModel.findOne({
      where: { groupId, userId, leftAt: null },
      transaction,
    });
  }

  assertElearningCompleted(user: Pick<User, 'role' | 'elearningCompletedAt'>) {
    if (!isEntourageAdmin(user.role) && !user.elearningCompletedAt) {
      throw new ForbiddenException(HelpGroupErrorCodes.ELEARNING_NOT_COMPLETED);
    }
  }

  async assertCanWrite(
    userId: string,
    slug: string
  ): Promise<HelpGroupWriteContext> {
    const group = await this.findPublishedGroupBySlug(slug);
    const [user, membership] = await Promise.all([
      this.findWriter(userId),
      this.findActiveMembership(group.id, userId),
    ]);
    if (!membership) {
      throw new ForbiddenException(HelpGroupErrorCodes.NOT_MEMBER);
    }
    this.assertElearningCompleted(user);
    return { group, user, membership };
  }

  /**
   * The front derives its invitations from this object instead of
   * duplicating the write rule.
   */
  async getViewerPermissions(
    group: HelpGroup,
    userId: string
  ): Promise<HelpGroupViewerPermissions> {
    const [user, membership] = await Promise.all([
      this.findWriter(userId),
      this.findActiveMembership(group.id, userId),
    ]);

    const canSkipElearning =
      isEntourageAdmin(user.role) || !!user.elearningCompletedAt;
    const state = !canSkipElearning
      ? HelpGroupViewerStates.MUST_COMPLETE_ELEARNING
      : membership
        ? HelpGroupViewerStates.CAN_WRITE
        : HelpGroupViewerStates.MUST_JOIN;

    return {
      state,
      charterAccepted: !!user.helpGroupsCharterAcceptedAt,
    };
  }
}
