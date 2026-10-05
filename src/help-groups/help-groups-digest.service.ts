import { Injectable, Logger } from '@nestjs/common';
import { InjectModel } from '@nestjs/sequelize';
import { QueryTypes, Transaction } from 'sequelize';
import { AuthService } from 'src/auth/auth.service';
import { MailsService } from 'src/mails/mails.service';
import { User } from 'src/users/models';
import {
  HELP_GROUPS_EMAIL_AUTOLOGIN_EXPIRATION_MS,
  helpGroupDiscussionUrl,
  helpGroupEmailsSettingsUrl,
  recipientAttributes,
} from './help-groups-notification-emails.service';
import {
  HELP_GROUPS_DIGEST_MAX_DISCUSSIONS,
  HelpGroupsWeeklyDigestEmail,
} from './help-groups.types';

const DAY_IN_MS = 24 * 60 * 60 * 1000;

// Lower bound of the first digest of a person
export const HELP_GROUPS_DIGEST_DEFAULT_PERIOD_DAYS = 7;

// People handled per batch, so that a run stays within the worker limits
export const HELP_GROUPS_DIGEST_BATCH_SIZE = 200;

const DELETED_AUTHOR_LABEL = 'Utilisateur supprimé';

interface DigestDiscussionRow {
  authorDeletedAt: Date | null;
  authorFirstName: string | null;
  groupId: string;
  groupName: string;
  groupSlug: string;
  id: string;
  title: string | null;
}

export interface HelpGroupsDigestResult {
  failed: number;
  sent: number;
  skipped: number;
}

/**
 * Weekly digest of the help groups, on Monday at 9 am (Paris): the activity
 * since the previous digest of the person (or the last 7 days) in the
 * discussions of the groups they joined with emails enabled, where they
 * published neither the discussion nor a reply. The real time notifications
 * cover the others. Never sent empty, never twice for the same activity:
 * `helpGroupsDigestSentAt` is moved in the same transaction.
 */
@Injectable()
export class HelpGroupsDigestService {
  private readonly logger = new Logger(HelpGroupsDigestService.name);

  constructor(
    @InjectModel(User)
    private userModel: typeof User,
    private authService: AuthService,
    private mailsService: MailsService
  ) {}

  async sendWeeklyDigests(): Promise<HelpGroupsDigestResult> {
    const result: HelpGroupsDigestResult = { sent: 0, skipped: 0, failed: 0 };
    let after: string | null = null;
    for (;;) {
      const userIds = await this.findRecipientIds(after);
      if (userIds.length === 0) {
        return result;
      }
      for (const userId of userIds) {
        try {
          const isSent = await this.sendDigest(userId);
          result[isSent ? 'sent' : 'skipped'] += 1;
        } catch (error) {
          result.failed += 1;
          this.logger.error(
            `[HelpGroupsDigest] digest of ${userId} failed: ${
              error instanceof Error ? error.message : String(error)
            }`
          );
        }
      }
      after = userIds[userIds.length - 1];
    }
  }

  /**
   * Non deleted people with at least one active membership with emails
   * enabled in a published group, by batches on their id.
   */
  private async findRecipientIds(after: string | null): Promise<string[]> {
    const rows = await this.userModel.sequelize.query<{ userId: string }>(
      `SELECT DISTINCT m."userId"
       FROM "HelpGroupMemberships" m
       JOIN "Users" u ON u."id" = m."userId" AND u."deletedAt" IS NULL
       JOIN "HelpGroups" g ON g."id" = m."groupId" AND g."deletedAt" IS NULL
         AND g."publishedAt" IS NOT NULL
       WHERE m."leftAt" IS NULL AND m."emailsEnabled" = true
         ${after ? 'AND m."userId" > :after' : ''}
       ORDER BY m."userId"
       LIMIT :limit`,
      {
        replacements: { after, limit: HELP_GROUPS_DIGEST_BATCH_SIZE },
        type: QueryTypes.SELECT,
      }
    );
    return rows.map(({ userId }) => userId);
  }

  /**
   * The digest of a person, in their own transaction: the user row is
   * locked, so that a concurrent run waits and then finds no activity left.
   * Its email is queued before the commit: a failure rolls back the move of
   * `helpGroupsDigestSentAt`.
   * Returns true when an email was queued.
   */
  async sendDigest(userId: string): Promise<boolean> {
    return this.userModel.sequelize.transaction(async (transaction) => {
      const user = await this.userModel.findByPk(userId, {
        attributes: [...recipientAttributes, 'helpGroupsDigestSentAt'],
        transaction,
        // Not FOR UPDATE: the autologin tokens created meanwhile reference
        // this row, which needs a key share lock on it
        lock: transaction.LOCK.NO_KEY_UPDATE,
      });
      if (!user) {
        return false;
      }
      const now = new Date();
      const since =
        user.helpGroupsDigestSentAt ??
        new Date(
          now.getTime() - HELP_GROUPS_DIGEST_DEFAULT_PERIOD_DAYS * DAY_IN_MS
        );
      const discussions = await this.findDigestDiscussions(
        user.id,
        since,
        now,
        transaction
      );

      if (discussions.length > 0) {
        await this.mailsService.sendHelpGroupsWeeklyDigest(
          user,
          await this.toDigestEmail(user.id, discussions)
        );
      }
      await this.userModel.update(
        { helpGroupsDigestSentAt: now },
        { where: { id: user.id }, transaction }
      );
      return discussions.length > 0;
    });
  }

  /**
   * Visible discussions of the groups of the person (active membership,
   * emails enabled, published group) published or with a visible reply in
   * `(since, now]`, where the person published neither the discussion nor a
   * reply (deleted ones included: they took part). The most recently active
   * first, one more than shown to know whether there are others.
   */
  private async findDigestDiscussions(
    userId: string,
    since: Date,
    now: Date,
    transaction: Transaction
  ): Promise<DigestDiscussionRow[]> {
    return this.userModel.sequelize.query<DigestDiscussionRow>(
      `SELECT p."id", p."title", g."id" AS "groupId", g."name" AS "groupName",
              g."slug" AS "groupSlug", a."firstName" AS "authorFirstName",
              a."deletedAt" AS "authorDeletedAt"
       FROM "HelpGroupMemberships" m
       JOIN "HelpGroups" g ON g."id" = m."groupId" AND g."deletedAt" IS NULL
         AND g."publishedAt" IS NOT NULL
       JOIN "PostContexts" pc ON pc."helpGroupId" = g."id"
       JOIN "Posts" p ON p."id" = pc."postId" AND p."deletedAt" IS NULL
         AND p."hiddenAt" IS NULL
       LEFT JOIN "Users" a ON a."id" = p."authorId"
       WHERE m."userId" = :userId AND m."leftAt" IS NULL
         AND m."emailsEnabled" = true
         AND p."authorId" <> :userId
         AND NOT EXISTS (
           SELECT 1 FROM "PostReplies" own
           WHERE own."postId" = p."id" AND own."authorId" = :userId
         )
         AND (
           (p."createdAt" > :since AND p."createdAt" <= :now)
           OR EXISTS (
             SELECT 1 FROM "PostReplies" r
             WHERE r."postId" = p."id" AND r."deletedAt" IS NULL
               AND r."hiddenAt" IS NULL
               AND r."createdAt" > :since AND r."createdAt" <= :now
           )
         )
       ORDER BY p."lastActivityAt" DESC, p."id" DESC
       LIMIT :limit`,
      {
        replacements: {
          userId,
          since,
          now,
          limit: HELP_GROUPS_DIGEST_MAX_DISCUSSIONS + 1,
        },
        type: QueryTypes.SELECT,
        transaction,
      }
    );
  }

  /**
   * Discussions grouped by group, in the order of their most recent
   * activity, with an autologin token per link (they are single use).
   */
  private async toDigestEmail(
    userId: string,
    rows: DigestDiscussionRow[]
  ): Promise<HelpGroupsWeeklyDigestEmail> {
    const token = () =>
      this.authService.generateAutologinToken(
        userId,
        HELP_GROUPS_EMAIL_AUTOLOGIN_EXPIRATION_MS
      );
    const hasMore = rows.length > HELP_GROUPS_DIGEST_MAX_DISCUSSIONS;
    const shown = rows.slice(0, HELP_GROUPS_DIGEST_MAX_DISCUSSIONS);

    const groups: HelpGroupsWeeklyDigestEmail['groups'] = [];
    const groupIndexes = new Map<string, number>();
    for (const row of shown) {
      if (!groupIndexes.has(row.groupId)) {
        groupIndexes.set(row.groupId, groups.length);
        groups.push({
          name: row.groupName,
          settingsUrl: helpGroupEmailsSettingsUrl(row.groupSlug, await token()),
          discussions: [],
        });
      }
      groups[groupIndexes.get(row.groupId)].discussions.push({
        title: row.title,
        authorFirstName:
          !row.authorFirstName || row.authorDeletedAt
            ? DELETED_AUTHOR_LABEL
            : row.authorFirstName,
        url: helpGroupDiscussionUrl(row.groupSlug, row.id, await token()),
      });
    }
    return {
      groups,
      groupsUrl: hasMore
        ? `${process.env.FRONT_URL}/backoffice/groupes?autologinToken=${encodeURIComponent(
            await token()
          )}`
        : null,
    };
  }
}
