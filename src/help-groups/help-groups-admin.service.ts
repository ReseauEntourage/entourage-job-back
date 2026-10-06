import {
  BadRequestException,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import { InjectModel } from '@nestjs/sequelize';
import { Op, UniqueConstraintError } from 'sequelize';
import { CreateHelpGroupDto, UpdateHelpGroupDto } from './dto';
import { HelpGroupsService } from './help-groups.service';
import { HelpGroupAdminItem } from './help-groups.types';
import { findAvailableSlug, slugify } from './help-groups.utils';
import { HelpGroup } from './models';

const SLUG_CREATE_MAX_ATTEMPTS = 5;

@Injectable()
export class HelpGroupsAdminService {
  constructor(
    @InjectModel(HelpGroup)
    private helpGroupModel: typeof HelpGroup,
    private helpGroupsService: HelpGroupsService
  ) {}

  /**
   * Non deleted groups (published or not), or only the deleted ones, with
   * the counters reserved to the administration.
   */
  async findAll(deleted: boolean): Promise<HelpGroupAdminItem[]> {
    const groups = await this.helpGroupModel.findAll({
      where: deleted ? { deletedAt: { [Op.ne]: null } } : {},
      paranoid: !deleted,
      order: [
        ['createdAt', 'DESC'],
        ['id', 'DESC'],
      ],
    });
    const groupIds = groups.map(({ id }) => id);
    const [membersCounts, discussionsStats] = await Promise.all([
      this.helpGroupsService.countMembersByGroupIds(groupIds),
      this.helpGroupsService.getDiscussionsStatsByGroupIds(groupIds),
    ]);

    return groups.map((group) =>
      this.toAdminItem(group, membersCounts, discussionsStats)
    );
  }

  private toAdminItem(
    group: HelpGroup,
    membersCounts: Record<string, number>,
    discussionsStats: Record<
      string,
      { count: number; lastActivityAt: Date | null }
    >
  ): HelpGroupAdminItem {
    return {
      id: group.id,
      slug: group.slug,
      name: group.name,
      description: group.description,
      publishedAt: group.publishedAt,
      pinnedAt: group.pinnedAt,
      createdAt: group.createdAt,
      deletedAt: group.deletedAt,
      membersCount: membersCounts[group.id] ?? 0,
      discussionsCount: discussionsStats[group.id]?.count ?? 0,
      lastActivityAt: discussionsStats[group.id]?.lastActivityAt ?? null,
    };
  }

  private async findOneOrFail(id: string): Promise<HelpGroup> {
    const group = await this.helpGroupModel.findByPk(id);
    if (!group) {
      throw new NotFoundException();
    }
    return group;
  }

  /**
   * Slugs already used by any group, deleted ones included, so that a slug
   * is never reassigned.
   */
  private async findTakenSlugs(baseSlug: string): Promise<string[]> {
    const groups = await this.helpGroupModel.findAll({
      attributes: ['slug'],
      where: {
        [Op.or]: [{ slug: baseSlug }, { slug: { [Op.like]: `${baseSlug}-%` } }],
      },
      paranoid: false,
    });
    return groups.map(({ slug }) => slug);
  }

  /**
   * Created unpublished. The unique index on `slug` guards against
   * concurrent creations: on violation, retry with the next available slug,
   * up to `SLUG_CREATE_MAX_ATTEMPTS` attempts.
   */
  async create(dto: CreateHelpGroupDto, adminId: string): Promise<HelpGroup> {
    const baseSlug = slugify(dto.name);
    const values = {
      name: dto.name,
      description: dto.description,
      createdById: adminId,
      publishedAt: null as Date | null,
      pinnedAt: null as Date | null,
    };

    const attemptedSlugs: string[] = [];
    for (let attempt = 1; ; attempt += 1) {
      const slug = findAvailableSlug(baseSlug, [
        ...(await this.findTakenSlugs(baseSlug)),
        ...attemptedSlugs,
      ]);
      try {
        return await this.helpGroupModel.create({ ...values, slug });
      } catch (error) {
        if (
          !(error instanceof UniqueConstraintError) ||
          attempt >= SLUG_CREATE_MAX_ATTEMPTS
        ) {
          throw error;
        }
        attemptedSlugs.push(slug);
      }
    }
  }

  // The slug is kept as is when the group is renamed
  async update(id: string, dto: UpdateHelpGroupDto): Promise<HelpGroup> {
    const group = await this.findOneOrFail(id);
    return group.update({
      name: dto.name,
      description: dto.description,
    });
  }

  async publish(id: string): Promise<HelpGroup> {
    const group = await this.findOneOrFail(id);
    if (group.publishedAt) {
      return group;
    }
    return group.update({ publishedAt: new Date() });
  }

  // Unpublishing also unpins
  async unpublish(id: string): Promise<HelpGroup> {
    const group = await this.findOneOrFail(id);
    return group.update({ publishedAt: null, pinnedAt: null });
  }

  async pin(id: string): Promise<HelpGroup> {
    const group = await this.findOneOrFail(id);
    if (!group.publishedAt) {
      throw new BadRequestException('Only a published group can be pinned');
    }
    if (group.pinnedAt) {
      return group;
    }
    return group.update({ pinnedAt: new Date() });
  }

  async unpin(id: string): Promise<HelpGroup> {
    const group = await this.findOneOrFail(id);
    return group.update({ pinnedAt: null });
  }

  /**
   * Soft delete. Does not cascade on discussions and replies: their
   * invisibility derives from the group state.
   */
  async remove(id: string, adminId: string): Promise<void> {
    const group = await this.findOneOrFail(id);
    await group.update({ deletedById: adminId });
    await group.destroy();
  }

  /**
   * Back to unpublished and unpinned. Discussions and replies deleted
   * individually before stay deleted, as they carry their own `deletedAt`.
   */
  async restore(id: string): Promise<HelpGroup> {
    const group = await this.helpGroupModel.findByPk(id, { paranoid: false });
    if (!group) {
      throw new NotFoundException();
    }
    if (!group.deletedAt) {
      return group;
    }
    await group.restore();
    return group.update({
      deletedById: null,
      publishedAt: null,
      pinnedAt: null,
    });
  }
}
