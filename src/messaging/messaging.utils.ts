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
          .map((participant: User) => participant.email)
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
  user: User,
  context: string,
  message?: string
): SlackBlockConfig => {
  const adminUserProfileUrl = `${process.env.FRONT_URL}/backoffice/admin/membres/${user.id}`;

  return {
    title: '🔬 Comportement suspect detecté 👿',
    context: [
      {
        title: `➡️ Que se passe-t-il ?`,
        content: context,
      },
      {
        title: '👿 Qui est-ce ?',
        content: `${user.firstName} ${user.lastName} <${user.email}>`,
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

export const determineIfShoudGiveFeedback = (
  conversation: Conversation,
  feedbackId: string | null
): boolean => {
  const now = new Date();
  const thirtyDaysAgo = new Date(now);
  thirtyDaysAgo.setDate(now.getDate() - 30);

  const lastMessageDate = conversation.messages?.[0]?.createdAt;
  const isLastMessageOlderThanThirtyDays = lastMessageDate
    ? new Date(lastMessageDate) < thirtyDaysAgo
    : true;

  const hasAllParticipantsSentMessage = conversation.participants.every(
    (participant) => {
      return conversation.messages.some(
        (message) => message.authorId === participant.id
      );
    }
  );

  const hasConversationFeedback = feedbackId !== null;

  const shouldGiveFeedback =
    isLastMessageOlderThanThirtyDays &&
    hasAllParticipantsSentMessage &&
    !hasConversationFeedback;

  return shouldGiveFeedback;
};
