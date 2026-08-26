import { isUUID } from 'class-validator';
import { SlackBlockConfig } from 'src/external-services/slack/slack.types';
import { User } from 'src/users/models';
import {
  ErrorMessagingInvalidCursor,
  ErrorMessagingMailingListInvalid,
} from './messaging.errors';
import { Conversation, ConversationType } from './models';

export interface MessageCursor {
  createdAt: Date;
  id: string;
}

const CURSOR_SEPARATOR = '_';

/**
 * Encodes a message's `(createdAt, id)` as a single opaque pagination
 * cursor, so the client never has to synchronize two query params.
 * `base64url` (not plain `base64`) so the result is safe to interpolate
 * directly into a query string: plain base64's `+`/`/`/`=` would
 * otherwise need percent-encoding, and a `+` left as-is is silently
 * read back as a space by query-string parsers.
 */
export const encodeMessageCursor = (cursor: MessageCursor): string => {
  return Buffer.from(
    `${cursor.createdAt.toISOString()}${CURSOR_SEPARATOR}${cursor.id}`
  ).toString('base64url');
};

export const decodeMessageCursor = (rawCursor: string): MessageCursor => {
  let decoded: string;
  try {
    decoded = Buffer.from(rawCursor, 'base64url').toString('utf-8');
  } catch {
    throw new ErrorMessagingInvalidCursor();
  }
  const separatorIndex = decoded.lastIndexOf(CURSOR_SEPARATOR);
  if (separatorIndex === -1) {
    throw new ErrorMessagingInvalidCursor();
  }
  const createdAtIso = decoded.slice(0, separatorIndex);
  const id = decoded.slice(separatorIndex + 1);
  const createdAt = new Date(createdAtIso);
  if (Number.isNaN(createdAt.getTime()) || !isUUID(id, 4)) {
    throw new ErrorMessagingInvalidCursor();
  }
  return { createdAt, id };
};

export const generateSlackMsgConfigConversationReported = (
  conversation: Conversation,
  reason: string,
  comment: string,
  reporterUser: User,
  referentSlackUserIds: string[]
): SlackBlockConfig => {
  return {
    title: '🚨 Une conversation a été signalée',
    context: [
      {
        title: 'Utilisateur ayant signalé la conversation',
        content: `${reporterUser.firstName} ${reporterUser.lastName} <${reporterUser.email}>`,
      },
      ...(referentSlackUserIds.length > 0
        ? [
            {
              title: '👮 Référent(s)',
              content: referentSlackUserIds.map((id) => `<@${id}>`).join(', '),
            },
          ]
        : []),
    ],
    msgParts: [
      {
        content: `*Conversation signalée* :\n${conversation.id}`,
      },
      {
        content: `*Participants à la conversation* :\n${conversation.participants
          .map((participant) => participant.email)
          .join(', ')}`,
      },
      {
        content: `Raison du signalement : ${reason}`,
      },
      {
        content: `Commentaire : ${comment}`,
      },
    ],
  };
};

export const generateSlackMsgConfigUserSuspiciousUser = (
  sender: User,
  recipients: User[],
  context: string,
  referentSlackUserId: string | null,
  message?: string
): SlackBlockConfig => {
  const adminUserProfileUrl = `${process.env.FRONT_URL}/backoffice/admin/membres/${sender.id}`;

  return {
    title: '🔬 Comportement suspect detecté 👿',
    context: [
      {
        title: `➡️ Que se passe-t-il ?`,
        content: context,
      },
      {
        title: '👿 Qui est-ce ?',
        content: `${sender.firstName} ${sender.lastName} <${sender.email}>`,
      },
      {
        title: '✉️ Destinataire(s)',
        content: recipients
          .map(
            (recipient) =>
              `${recipient.firstName} ${recipient.lastName} <${recipient.email}>`
          )
          .join('\n'),
      },
      ...(referentSlackUserId
        ? [
            {
              title: '👮 Référent',
              content: `<@${referentSlackUserId}>`,
            },
          ]
        : []),
    ],
    msgParts: [
      {
        content: `*Message* :\n${message}`,
      },
    ],
    actions: [
      {
        label: 'Voir le profil',
        url: adminUserProfileUrl,
        value: 'see-profile',
      },
    ],
  };
};

/**
 * Determine if the user can give feedback on a conversation
 * 3 conditions :
 *  - The last message in the conversation is older than 30 days
 *  - All participants have sent at least one message
 *  - The user has not already given feedback
 */
export const determineIfShoudGiveFeedback = (
  conversation: Conversation,
  feedbackRating: number | null,
  feedbackDate: Date | null
): boolean => {
  if (conversation.type !== ConversationType.DIRECT) {
    return false;
  }

  const now = new Date();
  const thirtyDaysAgo = new Date(now);
  thirtyDaysAgo.setDate(now.getDate() - 30);

  const lastConversationMessageDate = conversation.messages?.[0]?.createdAt;
  const isLastMessageOlderThanThirtyDays = lastConversationMessageDate
    ? new Date(lastConversationMessageDate) < thirtyDaysAgo
    : false;

  const hasAllParticipantsSentMessage = conversation.participants.every(
    (participant) => {
      return conversation.messages.some(
        (message) => message.authorId === participant.id
      );
    }
  );

  const userHasGivenFeedback = feedbackRating !== null || feedbackDate !== null;

  const shouldGiveFeedback =
    isLastMessageOlderThanThirtyDays &&
    hasAllParticipantsSentMessage &&
    !userHasGivenFeedback;

  return shouldGiveFeedback;
};

export const bindVariableInContent = (
  content: string,
  variables: Record<string, string>
): string => {
  let boundContent = content;
  for (const [key, value] of Object.entries(variables)) {
    const placeholder = `{{${key}}}`;
    boundContent = boundContent.replace(
      new RegExp(placeholder.replace(/[.*+?^${}()|[\]\\]/g, '\\$&'), 'g'),
      value
    );
  }
  // Vérifie s'il reste des variables non remplacées
  const unreplaced = boundContent.match(/{{[^}]+}}/g);
  if (unreplaced) {
    throw new ErrorMessagingMailingListInvalid(
      'Votre message contient des variables non reconnues : ' +
        unreplaced.join(', ')
    );
  }
  return boundContent;
};
