import { Injectable, Logger } from '@nestjs/common';
import { InjectModel } from '@nestjs/sequelize';
import { AuthService } from 'src/auth/auth.service';
import {
  isMailjetTemplateConfigured,
  MailjetTemplates,
} from 'src/external-services/mailjet/mailjet.types';
import { MailsService } from 'src/mails/mails.service';
import { NotificationsService } from 'src/notifications/notifications.service';
import {
  NotificationSubjectTypes,
  NotificationTypes,
} from 'src/notifications/notifications.types';
import { toExcerpt } from 'src/notifications/notifications.utils';
import { SendHelpGroupNotificationEmailJob } from 'src/queues/queues.types';
import { User } from 'src/users/models';
import { HelpGroupsNotificationsService } from './help-groups-notifications.service';
import {
  HelpGroupNotificationEmailKind,
  HelpGroupNotificationEmailKinds,
} from './help-groups.types';

const HOUR_IN_MS = 60 * 60 * 1000;

// The links of the help groups emails open the platform without logging in
export const HELP_GROUPS_EMAIL_AUTOLOGIN_EXPIRATION_MS = 24 * HOUR_IN_MS;

export const HELP_GROUP_EMAIL_EXCERPT_MAX_LENGTH = 200;

export const recipientAttributes = [
  'id',
  'email',
  'firstName',
  'lastName',
  'role',
  'zone',
];

export const helpGroupDiscussionUrl = (
  slug: string,
  discussionId: string,
  autologinToken: string,
  replyId?: string | null
) =>
  `${process.env.FRONT_URL}/backoffice/groupes/${slug}/discussions/${discussionId}?${
    replyId ? `replyId=${replyId}&` : ''
  }autologinToken=${encodeURIComponent(autologinToken)}`;

export const helpGroupEmailsSettingsUrl = (
  slug: string,
  autologinToken: string
) =>
  `${process.env.FRONT_URL}/backoffice/groupes/${slug}?emails=1&autologinToken=${encodeURIComponent(
    autologinToken
  )}`;

/**
 * Immediate email of a help group notification event, run by the delayed
 * `SEND_HELP_GROUP_NOTIFICATION_EMAIL` job. Everything is checked again when
 * it runs, and nothing is sent when:
 * 1. the event is seen, even if other events of the row are not;
 * 2. the event is no longer in the notification (message deleted or hidden,
 *    reaction removed);
 * 3. its email was already sent (replayed job);
 * 4. the person is no longer an active member, their account is deleted, or
 *    the group is no longer visible;
 * 5. the person turned off the emails of the group.
 */
@Injectable()
export class HelpGroupsNotificationEmailsService {
  private readonly logger = new Logger(
    HelpGroupsNotificationEmailsService.name
  );

  constructor(
    @InjectModel(User)
    private userModel: typeof User,
    private notificationsService: NotificationsService,
    private helpGroupsNotifications: HelpGroupsNotificationsService,
    private authService: AuthService,
    private mailsService: MailsService
  ) {}

  async sendNotificationEmail({
    notificationId,
    eventId,
  }: SendHelpGroupNotificationEmailJob): Promise<string> {
    const skip = (reason: string) =>
      `Help group notification email of ${eventId} not sent: ${reason}`;

    // Until its Mailjet template exists, nothing is sent nor marked as sent
    if (
      !isMailjetTemplateConfigured(MailjetTemplates.HELP_GROUP_NOTIFICATION)
    ) {
      this.logger.warn(
        '[HelpGroupsNotificationEmails] HELP_GROUP_NOTIFICATION template not configured'
      );
      return skip('Mailjet template not configured');
    }

    const notification =
      await this.notificationsService.findById(notificationId);
    const event = notification?.events.find((e) => e.eventId === eventId);
    if (!event) {
      return skip('event removed');
    }
    if (event.seenAt) {
      return skip('event seen');
    }
    if (event.emailedAt) {
      return skip('already sent');
    }

    const group = notification.groupId
      ? await this.helpGroupsNotifications.findReadableGroup(
          notification.groupId
        )
      : null;
    if (!group) {
      return skip('group not visible');
    }
    const [membership] =
      await this.helpGroupsNotifications.findActiveMemberships(group.id, [
        notification.userId,
      ]);
    if (!membership) {
      return skip('not an active member');
    }
    if (!membership.emailsEnabled) {
      return skip('emails of the group turned off');
    }

    const content = await this.resolveContent(
      notification.type,
      notification.subjectType,
      notification.subjectId,
      eventId,
      notification.userId
    );
    if (!content) {
      return skip('content no longer visible');
    }
    const [recipient, actorFirstNames] = await Promise.all([
      this.userModel.findByPk(notification.userId, {
        attributes: recipientAttributes,
      }),
      this.helpGroupsNotifications.findFirstNames([event.actorId]),
    ]);
    if (!recipient) {
      return skip('account deleted');
    }
    if (!actorFirstNames.has(event.actorId)) {
      return skip('actor account deleted');
    }

    // Claimed before sending: a concurrent or replayed job sends nothing
    if (
      !(await this.notificationsService.claimEventEmail(
        notificationId,
        eventId
      ))
    ) {
      return skip('already sent or seen');
    }
    try {
      const [discussionToken, settingsToken] = await Promise.all([
        this.authService.generateAutologinToken(
          recipient.id,
          HELP_GROUPS_EMAIL_AUTOLOGIN_EXPIRATION_MS
        ),
        this.authService.generateAutologinToken(
          recipient.id,
          HELP_GROUPS_EMAIL_AUTOLOGIN_EXPIRATION_MS
        ),
      ]);
      await this.mailsService.sendHelpGroupNotification(recipient, {
        kind: content.kind,
        actorFirstName: actorFirstNames.get(event.actorId),
        discussionTitle: content.discussionTitle,
        groupName: group.name,
        excerpt: content.excerpt,
        discussionUrl: helpGroupDiscussionUrl(
          group.slug,
          content.discussionId,
          discussionToken,
          content.replyId
        ),
        settingsUrl: helpGroupEmailsSettingsUrl(group.slug, settingsToken),
      });
    } catch (error) {
      // Given back for the retry of the job
      await this.notificationsService.releaseEventEmail(
        notificationId,
        eventId
      );
      throw error;
    }
    return `Help group notification email of ${eventId} sent to ${recipient.id}`;
  }

  /**
   * The content announced by the event, if it is still visible.
   */
  private async resolveContent(
    type: string,
    subjectType: string,
    subjectId: string,
    eventId: string,
    recipientId: string
  ): Promise<{
    discussionId: string;
    discussionTitle: string | null;
    excerpt: string | null;
    kind: HelpGroupNotificationEmailKind;
    replyId: string | null;
  } | null> {
    if (type === NotificationTypes.HELP_GROUP_REPLY) {
      const [discussions, replies] = await Promise.all([
        this.helpGroupsNotifications.findVisibleDiscussions([subjectId]),
        this.helpGroupsNotifications.findVisibleReplies([eventId]),
      ]);
      const discussion = discussions.get(subjectId);
      const reply = replies.get(eventId);
      if (!discussion || !reply || reply.postId !== discussion.id) {
        return null;
      }
      return {
        kind:
          discussion.authorId === recipientId
            ? HelpGroupNotificationEmailKinds.REPLY_TO_AUTHOR
            : HelpGroupNotificationEmailKinds.REPLY_TO_PARTICIPANT,
        discussionId: discussion.id,
        discussionTitle: discussion.title,
        excerpt: toExcerpt(reply.content, HELP_GROUP_EMAIL_EXCERPT_MAX_LENGTH),
        replyId: reply.id,
      };
    }

    if (type === NotificationTypes.HELP_GROUP_REACTION) {
      const isReply = subjectType === NotificationSubjectTypes.POST_REPLY;
      const [reactionIds, replies] = await Promise.all([
        this.helpGroupsNotifications.findActiveReactionIds([eventId]),
        isReply
          ? this.helpGroupsNotifications.findVisibleReplies([subjectId])
          : Promise.resolve(new Map()),
      ]);
      const discussionId = isReply ? replies.get(subjectId)?.postId : subjectId;
      if (!reactionIds.has(eventId) || !discussionId) {
        return null;
      }
      const discussion = (
        await this.helpGroupsNotifications.findVisibleDiscussions([
          discussionId,
        ])
      ).get(discussionId);
      if (!discussion) {
        return null;
      }
      return {
        kind: HelpGroupNotificationEmailKinds.REACTION,
        discussionId,
        discussionTitle: discussion.title,
        excerpt: null,
        replyId: isReply ? subjectId : null,
      };
    }

    this.logger.warn(`Unknown notification type ${type}`);
    return null;
  }
}
