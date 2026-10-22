import { Injectable, Logger } from '@nestjs/common';
import { InjectModel } from '@nestjs/sequelize';
import { QueryTypes, Transaction } from 'sequelize';
import { AuthService } from 'src/auth/auth.service';
import {
  isMailjetTemplateConfigured,
  MailjetTemplates,
} from 'src/external-services/mailjet/mailjet.types';
import { MailsService } from 'src/mails/mails.service';
import { NotificationTypes } from 'src/notifications/notifications.types';
import { toWordExcerpt } from 'src/notifications/notifications.utils';
import { User } from 'src/users/models';
import {
  HELP_GROUPS_EMAIL_AUTOLOGIN_EXPIRATION_MS,
  helpGroupDiscussionUrl,
  helpGroupEmailsSettingsUrl,
  recipientAttributes,
} from './help-groups-notification-emails.service';
import {
  HELP_GROUPS_DIGEST_MAX_DISCUSSIONS,
  HelpGroupsDailyDigestEmail,
} from './help-groups.types';

// Key of the lock that keeps the runs of the digest from overlapping
export const HELP_GROUPS_DIGEST_LOCK_KEY = 'help-groups-daily-digest';

// People handled per batch, so that a run stays within the worker limits
export const HELP_GROUPS_DIGEST_BATCH_SIZE = 200;

export const HELP_GROUPS_DIGEST_PLURAL_SUBJECT =
  'Nouvelles discussions dans vos groupes';

// "Unseen and not yet emailed" event of a notification row
const PENDING_EVENT_SQL = `EXISTS (
  SELECT 1 FROM jsonb_array_elements(n."events") AS e
  WHERE e->>'seenAt' IS NULL AND e->>'emailedAt' IS NULL
)`;

interface DigestDiscussionRow {
  authorFirstName: string;
  content: string | null;
  groupId: string;
  groupName: string;
  groupSlug: string;
  id: string;
  notificationId: string;
  title: string | null;
}

export interface HelpGroupsDigestResult {
  failed: number;
  sent: number;
  skipped: number;
}

/**
 * Daily email of the new discussions of the help groups, at 6 pm (Paris):
 * the `HELP_GROUP_DISCUSSION` events of the person that they neither saw on
 * the screen nor received by email yet, in the groups they are still an
 * active member of with emails enabled. Never sent empty, never twice for
 * the same discussion: the events are marked as emailed in the same
 * transaction that selects them.
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

  async sendDailyDigests(): Promise<HelpGroupsDigestResult> {
    const result: HelpGroupsDigestResult = { sent: 0, skipped: 0, failed: 0 };
    // Until its Mailjet template exists, no email is sent and the events stay
    // due for the first run that can send them
    if (
      !isMailjetTemplateConfigured(
        MailjetTemplates.HELP_GROUPS_DAILY_DISCUSSIONS
      )
    ) {
      this.logger.warn(
        '[HelpGroupsDigest] HELP_GROUPS_DAILY_DISCUSSIONS template not configured: no email sent'
      );
      return result;
    }
    // One run at a time, whatever started it (several workers, a retry, a
    // manual run). The lock is held by a transaction that stays open for the
    // whole run, and is released with it, even if the worker dies.
    return this.userModel.sequelize.transaction(async (lockTransaction) => {
      const [{ locked }] = await this.userModel.sequelize.query<{
        locked: boolean;
      }>('SELECT pg_try_advisory_xact_lock(hashtext(:key)) AS "locked"', {
        replacements: { key: HELP_GROUPS_DIGEST_LOCK_KEY },
        type: QueryTypes.SELECT,
        transaction: lockTransaction,
      });
      if (!locked) {
        this.logger.warn(
          '[HelpGroupsDigest] another run is in progress: no email sent'
        );
        return result;
      }
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
    });
  }

  /**
   * People with at least one new discussion not seen nor emailed yet, by
   * batches on their id. Whether it can still be sent is checked per person.
   */
  private async findRecipientIds(after: string | null): Promise<string[]> {
    const rows = await this.userModel.sequelize.query<{ userId: string }>(
      `SELECT DISTINCT n."userId"
       FROM "Notifications" n
       WHERE n."type" = :type AND ${PENDING_EVENT_SQL}
         ${after ? 'AND n."userId" > :after' : ''}
       ORDER BY n."userId"
       LIMIT :limit`,
      {
        replacements: {
          type: NotificationTypes.HELP_GROUP_DISCUSSION,
          after,
          limit: HELP_GROUPS_DIGEST_BATCH_SIZE,
        },
        type: QueryTypes.SELECT,
      }
    );
    return rows.map(({ userId }) => userId);
  }

  /**
   * The email of a person, sent within a run of `sendDailyDigests`, which
   * keeps two runs from overlapping. Its content and the marking of the
   * events as emailed are committed in their own transaction, the user row
   * being locked so that a concurrent run waits and then finds nothing left.
   * The email is queued after the commit: should the queue fail, the events
   * are given back, so that the next run sends them. An email is thus never
   * queued twice. Returns true when an email was queued.
   */
  async sendDigest(userId: string): Promise<boolean> {
    const prepared = await this.userModel.sequelize.transaction(
      async (transaction) => {
        const user = await this.userModel.findByPk(userId, {
          attributes: recipientAttributes,
          transaction,
          // Not FOR UPDATE: the autologin tokens created meanwhile reference
          // this row, which needs a key share lock on it
          lock: transaction.LOCK.NO_KEY_UPDATE,
        });
        if (!user) {
          return null;
        }
        const discussions = await this.findDigestDiscussions(
          user.id,
          transaction
        );
        if (discussions.length === 0) {
          return null;
        }
        const emailedAt = new Date().toISOString();
        await this.markEmailed(
          discussions.map(({ notificationId }) => notificationId),
          emailedAt,
          transaction
        );
        return {
          user,
          emailedAt,
          notificationIds: discussions.map(
            ({ notificationId }) => notificationId
          ),
          email: await this.toDigestEmail(user.id, discussions),
        };
      }
    );
    if (!prepared) {
      return false;
    }
    const { user, email, emailedAt, notificationIds } = prepared;
    try {
      await this.mailsService.sendHelpGroupsDailyDigest(user, email);
    } catch (error) {
      await this.releaseEmailed(notificationIds, emailedAt);
      throw error;
    }
    return true;
  }

  /**
   * Visible discussions announced by an event not seen nor emailed yet, in
   * a published group the person is still an active member of with emails
   * enabled, by an author whose account still exists. The most recent first.
   */
  private async findDigestDiscussions(
    userId: string,
    transaction: Transaction
  ): Promise<DigestDiscussionRow[]> {
    return this.userModel.sequelize.query<DigestDiscussionRow>(
      `SELECT n."id" AS "notificationId", p."id", p."title", p."content",
              g."id" AS "groupId", g."name" AS "groupName",
              g."slug" AS "groupSlug", a."firstName" AS "authorFirstName"
       FROM "Notifications" n
       JOIN "HelpGroups" g ON g."id" = n."groupId" AND g."deletedAt" IS NULL
         AND g."publishedAt" IS NOT NULL
       JOIN "HelpGroupMemberships" m ON m."groupId" = g."id"
         AND m."userId" = n."userId" AND m."leftAt" IS NULL
         AND m."emailsEnabled" = true
       JOIN "Posts" p ON p."id" = n."subjectId" AND p."deletedAt" IS NULL
         AND p."hiddenAt" IS NULL
       JOIN "Users" a ON a."id" = p."authorId" AND a."deletedAt" IS NULL
       WHERE n."userId" = :userId AND n."type" = :type AND ${PENDING_EVENT_SQL}
       ORDER BY p."createdAt" DESC, p."id" DESC`,
      {
        replacements: {
          userId,
          type: NotificationTypes.HELP_GROUP_DISCUSSION,
        },
        type: QueryTypes.SELECT,
        transaction,
      }
    );
  }

  private async markEmailed(
    notificationIds: string[],
    emailedAt: string,
    transaction: Transaction
  ) {
    await this.userModel.sequelize.query(
      `UPDATE "Notifications" n SET "events" = (
         SELECT jsonb_agg(
           CASE WHEN e->>'seenAt' IS NULL AND e->>'emailedAt' IS NULL
             THEN e || jsonb_build_object('emailedAt', CAST(:emailedAt AS text))
             ELSE e END
           ORDER BY ord)
         FROM jsonb_array_elements(n."events") WITH ORDINALITY AS t(e, ord)
       ), "updatedAt" = NOW()
       WHERE n."id" IN (:ids)`,
      { replacements: { ids: notificationIds, emailedAt }, transaction }
    );
  }

  // Gives back the events marked by a run whose email could not be queued
  private async releaseEmailed(notificationIds: string[], emailedAt: string) {
    await this.userModel.sequelize.query(
      `UPDATE "Notifications" n SET "events" = (
         SELECT jsonb_agg(
           CASE WHEN e->>'emailedAt' = :emailedAt
             THEN e || '{"emailedAt": null}'::jsonb ELSE e END
           ORDER BY ord)
         FROM jsonb_array_elements(n."events") WITH ORDINALITY AS t(e, ord)
       ), "updatedAt" = NOW()
       WHERE n."id" IN (:ids)`,
      { replacements: { ids: notificationIds, emailedAt } }
    );
  }

  /**
   * Discussions grouped by group, in the order of their most recent
   * discussion, with an autologin token per link (they are single use).
   * Ten discussions at most; the others are reached by the groups list.
   */
  private async toDigestEmail(
    userId: string,
    rows: DigestDiscussionRow[]
  ): Promise<HelpGroupsDailyDigestEmail> {
    const token = () =>
      this.authService.generateAutologinToken(
        userId,
        HELP_GROUPS_EMAIL_AUTOLOGIN_EXPIRATION_MS
      );
    const hasMore = rows.length > HELP_GROUPS_DIGEST_MAX_DISCUSSIONS;
    const shown = rows.slice(0, HELP_GROUPS_DIGEST_MAX_DISCUSSIONS);

    const groups: HelpGroupsDailyDigestEmail['groups'] = [];
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
        authorFirstName: row.authorFirstName,
        excerpt: toWordExcerpt(row.content ?? ''),
        url: helpGroupDiscussionUrl(row.groupSlug, row.id, await token()),
      });
    }
    return {
      subject:
        rows.length === 1
          ? `${rows[0].authorFirstName} a ouvert une discussion dans « ${rows[0].groupName} »`
          : HELP_GROUPS_DIGEST_PLURAL_SUBJECT,
      groups,
      groupsUrl: hasMore
        ? `${process.env.FRONT_URL}/backoffice/groupes?autologinToken=${encodeURIComponent(
            await token()
          )}`
        : null,
    };
  }
}
