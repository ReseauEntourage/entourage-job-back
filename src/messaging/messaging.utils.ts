import { SlackBlockConfig } from 'src/external-services/slack/slack.types';
import { User } from 'src/users/models';
import { Conversation } from './models';

export const generateSlackMsgConfigConversationReported = (
  conversation: Conversation,
  reason: string,
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
        content: `*Raison du signalement* :\n${reason}`,
      },
    ],
  };
};
