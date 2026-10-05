import { randomUUID } from 'crypto';
import { ForbiddenException, Injectable, Logger } from '@nestjs/common';
import { InjectModel } from '@nestjs/sequelize';
import { Op, QueryTypes, Transaction, WhereOptions } from 'sequelize';
import { PusherService } from 'src/external-services/pusher/pusher.service';
import {
  getUserPrivateChannel,
  PusherEvents,
  USER_PRIVATE_CHANNEL_PREFIX,
} from 'src/external-services/pusher/pusher.types';
import { Page } from 'src/posts/posts.service';
import { decodePostCursor, encodePostCursor } from 'src/posts/posts.utils';
import { Notification } from './models';
import {
  NOTIFICATIONS_PAGE_SIZE,
  NOTIFICATIONS_RETENTION_DAYS,
  NotificationEvent,
  NotificationItem,
  NotificationPresenter,
  NotificationRow,
  NotificationSeenCoverageByType,
  NotificationSeenCoverages,
  NotificationSubjectType,
  NotificationType,
} from './notifications.types';
import { areAllEventsSeen, getLastEventAt } from './notifications.utils';

const DAY_IN_MS = 24 * 60 * 60 * 1000;

export interface NotificationEventInput {
  event: { actorId: string; at: Date; eventId: string };
  groupId: string | null;
  subjectId: string;
  subjectType: NotificationSubjectType;
  type: NotificationType;
  userId: string;
}

// Events to remove from the notifications of a subject
export type NotificationEventMatch = { eventId: string } | { actorId: string };

const matchesEvent = (
  event: NotificationEvent,
  match: NotificationEventMatch
) =>
  'eventId' in match
    ? event.eventId === match.eventId
    : event.actorId === match.actorId;

const retentionStart = () =>
  new Date(Date.now() - NOTIFICATIONS_RETENTION_DAYS * DAY_IN_MS);

const toRow = (notification: Notification): NotificationRow => ({
  id: notification.id,
  userId: notification.userId,
  type: notification.type,
  subjectType: notification.subjectType,
  subjectId: notification.subjectId,
  groupId: notification.groupId,
  events: notification.events,
  seenAt: notification.seenAt,
  lastEventAt: notification.lastEventAt,
});

/**
 * Generic notifications center: one row per (recipient, type, subject),
 * events grouped in it, "seen" tracked per event. Each producing domain
 * writes its events here and registers a presenter for its types. Every
 * change is signaled to the recipient on their private Pusher channel, with
 * an empty payload.
 */
@Injectable()
export class NotificationsService {
  private readonly logger = new Logger(NotificationsService.name);

  private readonly presenters = new Map<
    NotificationType,
    NotificationPresenter
  >();

  constructor(
    @InjectModel(Notification)
    private notificationModel: typeof Notification,
    private pusherService: PusherService
  ) {}

  registerPresenter(
    types: NotificationType[],
    presenter: NotificationPresenter
  ) {
    types.forEach((type) => this.presenters.set(type, presenter));
  }

  private transaction<T>(callback: (transaction: Transaction) => Promise<T>) {
    return this.notificationModel.sequelize.transaction(callback);
  }

  // ---------------------------------------------------------------------
  // Writes of the producers
  // ---------------------------------------------------------------------

  /**
   * Adds an event to the notification of its subject, created if needed, in
   * a single statement: the row becomes unseen again and moves to the top.
   * An event already in the row is not added twice. Returns the notification
   * id when the event was added, null otherwise.
   */
  async upsertEvent(input: NotificationEventInput): Promise<string | null> {
    const event: NotificationEvent = {
      actorId: input.event.actorId,
      eventId: input.event.eventId,
      at: input.event.at.toISOString(),
      seenAt: null,
      emailedAt: null,
    };
    const rows = await this.notificationModel.sequelize.query<{ id: string }>(
      `INSERT INTO "Notifications" ("id", "userId", "type", "subjectType",
         "subjectId", "groupId", "events", "seenAt", "lastEventAt",
         "createdAt", "updatedAt")
       VALUES (:id, :userId, :type, :subjectType, :subjectId, :groupId,
         CAST(:events AS jsonb), NULL, :at, NOW(), NOW())
       ON CONFLICT ("userId", "type", "subjectType", "subjectId") DO UPDATE SET
         "events" = "Notifications"."events" || EXCLUDED."events",
         "lastEventAt" = GREATEST("Notifications"."lastEventAt", EXCLUDED."lastEventAt"),
         "seenAt" = NULL,
         "groupId" = EXCLUDED."groupId",
         "updatedAt" = NOW()
       WHERE NOT "Notifications"."events" @> CAST(:eventMatch AS jsonb)
       RETURNING "id"`,
      {
        replacements: {
          id: randomUUID(),
          userId: input.userId,
          type: input.type,
          subjectType: input.subjectType,
          subjectId: input.subjectId,
          groupId: input.groupId,
          events: JSON.stringify([event]),
          eventMatch: JSON.stringify([{ eventId: event.eventId }]),
          at: input.event.at,
        },
        type: QueryTypes.SELECT,
      }
    );
    return rows[0]?.id ?? null;
  }

  /**
   * Removes the matching events from the notifications of the given
   * subjects. A notification left without any event is deleted; the others
   * get their last event date and their "seen" state recomputed. Returns the
   * recipients whose notifications changed.
   */
  async removeEvents(
    type: NotificationType,
    subjectIds: string[],
    match: NotificationEventMatch
  ): Promise<string[]> {
    if (subjectIds.length === 0) {
      return [];
    }
    return this.transaction(async (transaction) => {
      const notifications = await this.notificationModel.findAll({
        where: { type, subjectId: subjectIds },
        transaction,
        lock: transaction.LOCK.UPDATE,
      });
      const userIds: string[] = [];
      for (const notification of notifications) {
        const events = notification.events.filter(
          (event) => !matchesEvent(event, match)
        );
        if (events.length === notification.events.length) {
          continue;
        }
        userIds.push(notification.userId);
        if (events.length === 0) {
          await notification.destroy({ transaction });
          continue;
        }
        await notification.update(
          {
            events,
            lastEventAt: getLastEventAt(events),
            seenAt: areAllEventsSeen(events)
              ? (notification.seenAt ?? new Date())
              : null,
          },
          { transaction }
        );
      }
      return userIds;
    });
  }

  /**
   * Deletes the notifications of the given subjects. Returns their
   * recipients.
   */
  async removeBySubjects(
    subjectType: NotificationSubjectType,
    subjectIds: string[],
    types?: NotificationType[]
  ): Promise<string[]> {
    if (subjectIds.length === 0) {
      return [];
    }
    const where: WhereOptions<Notification> = {
      subjectType,
      subjectId: subjectIds,
      ...(types ? { type: types } : {}),
    };
    const notifications = await this.notificationModel.findAll({
      attributes: ['userId'],
      where,
    });
    if (notifications.length === 0) {
      return [];
    }
    await this.notificationModel.destroy({ where });
    return notifications.map(({ userId }) => userId);
  }

  // ---------------------------------------------------------------------
  // "Seen"
  // ---------------------------------------------------------------------

  /**
   * Marks seen the events covered by the messages displayed on the screen of
   * the recipient: a reply event once the reply is displayed, the reactions
   * to a message once the message is displayed. A notification becomes seen
   * once all its events are. Returns true when something changed.
   */
  async markSeen(userId: string, messageIds: string[]): Promise<boolean> {
    const ids = new Set(messageIds);
    const changed = await this.transaction(async (transaction) => {
      const notifications = await this.notificationModel.findAll({
        where: { userId, seenAt: null },
        transaction,
        lock: transaction.LOCK.UPDATE,
      });
      const now = new Date().toISOString();
      let hasChanged = false;
      for (const notification of notifications) {
        const coversSubject =
          NotificationSeenCoverageByType[notification.type] ===
            NotificationSeenCoverages.SUBJECT &&
          ids.has(notification.subjectId);
        let hasRowChanged = false;
        const events = notification.events.map((event) => {
          const isCovered = coversSubject || ids.has(event.eventId);
          if (!isCovered || event.seenAt) {
            return event;
          }
          hasRowChanged = true;
          return { ...event, seenAt: now };
        });
        if (!hasRowChanged) {
          continue;
        }
        hasChanged = true;
        await notification.update(
          {
            events,
            seenAt: areAllEventsSeen(events) ? new Date(now) : null,
          },
          { transaction }
        );
      }
      return hasChanged;
    });
    if (changed) {
      this.notifyChanged([userId]);
    }
    return changed;
  }

  // ---------------------------------------------------------------------
  // Emails of the producers
  // ---------------------------------------------------------------------

  async findById(id: string): Promise<NotificationRow | null> {
    const notification = await this.notificationModel.findByPk(id);
    return notification ? toRow(notification) : null;
  }

  /**
   * Claims the immediate email of an event: sets its `emailedAt` if the
   * event is still in the notification, unseen and not emailed yet. Returns
   * false otherwise, so that a replayed job sends nothing.
   */
  async claimEventEmail(
    notificationId: string,
    eventId: string
  ): Promise<boolean> {
    return this.updateEvent(notificationId, eventId, (event) =>
      event.seenAt || event.emailedAt
        ? null
        : { ...event, emailedAt: new Date().toISOString() }
    );
  }

  // Gives the email back when it could not be queued, for the job retry
  async releaseEventEmail(notificationId: string, eventId: string) {
    await this.updateEvent(notificationId, eventId, (event) => ({
      ...event,
      emailedAt: null,
    }));
  }

  private async updateEvent(
    notificationId: string,
    eventId: string,
    update: (event: NotificationEvent) => NotificationEvent | null
  ): Promise<boolean> {
    return this.transaction(async (transaction) => {
      const notification = await this.notificationModel.findByPk(
        notificationId,
        { transaction, lock: transaction.LOCK.UPDATE }
      );
      const index =
        notification?.events.findIndex((event) => event.eventId === eventId) ??
        -1;
      if (index === -1) {
        return false;
      }
      const updated = update(notification.events[index]);
      if (!updated) {
        return false;
      }
      const events = [...notification.events];
      events[index] = updated;
      await notification.update({ events }, { transaction });
      return true;
    });
  }

  // ---------------------------------------------------------------------
  // Reads of the bell
  // ---------------------------------------------------------------------

  /**
   * Notifications of the last 30 days, most recently updated first,
   * paginated on `(lastEventAt, id)`. A notification whose content can no
   * longer be shown is left out by its presenter.
   */
  async findPage(
    userId: string,
    cursor?: string,
    limit = NOTIFICATIONS_PAGE_SIZE
  ): Promise<Page<NotificationItem>> {
    const decodedCursor = cursor ? decodePostCursor(cursor) : null;
    const notifications = await this.notificationModel.findAll({
      where: {
        [Op.and]: [
          { userId, lastEventAt: { [Op.gte]: retentionStart() } },
          decodedCursor
            ? {
                [Op.or]: [
                  { lastEventAt: { [Op.lt]: decodedCursor.date } },
                  {
                    lastEventAt: decodedCursor.date,
                    id: { [Op.lt]: decodedCursor.id },
                  },
                ],
              }
            : {},
        ],
      },
      order: [
        ['lastEventAt', 'DESC'],
        ['id', 'DESC'],
      ],
      limit: limit + 1,
    });
    const pageRows = notifications.slice(0, limit).map(toRow);
    const items = await this.present(pageRows, userId);
    const last = pageRows[pageRows.length - 1];
    return {
      items,
      nextCursor:
        notifications.length > limit
          ? encodePostCursor({ date: last.lastEventAt, id: last.id })
          : null,
    };
  }

  private async present(
    rows: NotificationRow[],
    userId: string
  ): Promise<NotificationItem[]> {
    const rowsByPresenter = new Map<NotificationPresenter, NotificationRow[]>();
    rows.forEach((row) => {
      const presenter = this.presenters.get(row.type);
      if (presenter) {
        rowsByPresenter.set(presenter, [
          ...(rowsByPresenter.get(presenter) ?? []),
          row,
        ]);
      }
    });
    const presented = new Map<string, NotificationItem>();
    for (const [presenter, presenterRows] of rowsByPresenter) {
      const items = await presenter.present(presenterRows, userId);
      items.forEach((item, id) => presented.set(id, item));
    }
    return rows.map(({ id }) => presented.get(id)).filter(Boolean);
  }

  /**
   * Number of unseen notifications (rows, not events) of the last 30 days.
   * Counted through the presenters, like the list: a row the list leaves out
   * (group unpublished, message deleted) never inflates the badge. The "9+"
   * cap is applied by the front.
   */
  async countUnseen(userId: string): Promise<number> {
    const notifications = await this.notificationModel.findAll({
      where: {
        userId,
        seenAt: null,
        lastEventAt: { [Op.gte]: retentionStart() },
      },
    });
    const items = await this.present(notifications.map(toRow), userId);
    return items.length;
  }

  /**
   * Deletes the notifications not updated for more than 30 days. Returns
   * the number of deleted rows.
   */
  async purgeExpired(): Promise<number> {
    return this.notificationModel.destroy({
      where: { lastEventAt: { [Op.lt]: retentionStart() } },
    });
  }

  // ---------------------------------------------------------------------
  // Realtime
  // ---------------------------------------------------------------------

  /**
   * Signals each recipient that their notifications changed. The payload is
   * empty: the front reloads its bell. A Pusher failure is logged and never
   * fails the write.
   */
  notifyChanged(userIds: string[]): void {
    new Set(userIds).forEach((userId) => {
      this.pusherService
        .sendEvent(
          getUserPrivateChannel(userId),
          PusherEvents.NOTIFICATIONS_CHANGED,
          {}
        )
        .catch((error) => {
          this.logger.warn(
            `[Notifications] ${PusherEvents.NOTIFICATIONS_CHANGED} not sent (userId=${userId}): ${
              error instanceof Error ? error.message : String(error)
            }`
          );
        });
    });
  }

  isUserChannel(channelName: string): boolean {
    return channelName.startsWith(USER_PRIVATE_CHANNEL_PREFIX);
  }

  /**
   * Signs a subscription to the private channel of a user for this user
   * only: anyone else gets a 403.
   */
  authorizeUserChannel(socketId: string, channelName: string, userId: string) {
    if (!socketId || !userId || channelName !== getUserPrivateChannel(userId)) {
      throw new ForbiddenException();
    }
    return this.pusherService.authorizeChannel(socketId, channelName);
  }
}
