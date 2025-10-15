import { SlackBlockConfig } from 'src/external-services/slack/slack.types';
import { User } from 'src/users/models';
import { Conversation } from './models';

export const generateSlackMsgConfigConversationReported = (
  conversation: Conversation,
  reason: string,
  comment: string,
  reporterUser: User
): SlackBlockConfig => {
  return {
    title: '🚨 Une conversation a été signalée',
    context: [
      {
        title: 'Utilisateur ayant signalé la conversation',
        content: `${reporterUser.firstName} ${reporterUser.lastName} <${reporterUser.email}>`,
      },
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
