import { SlackBlockConfig } from 'src/external-services/slack/slack.types';
import { User } from 'src/users/models';
import { Message } from './models';

export const generateSlackMsgConfigMessageReported = (
  message: Message,
  reason: string,
  senderUser: User,
  reporterUser: User
): SlackBlockConfig => {
  return {
    title: '🚨 Un message a été signalé',
    context: [
      {
        title: 'Conversation ID',
        content: message.conversationId,
      },
      {
        title: 'Participants à la conversations\n',
        content: message.conversation.participants
          .map((participant: User) => participant.email)
          .join(', '),
      },
      {
        title: 'Utilisateur ayant signalé le message',
        content: `${reporterUser.firstName} ${reporterUser.lastName} <${reporterUser.email}>`,
      },
    ],
    msgParts: [
      {
        content: `*Expéditeur du message :*\n${senderUser.email}`,
      },
      {
        content: `*Contenu du message signalé* :\n${message.content}`,
      },
      {
        content: `*Raison du signalement* :\n${reason}`,
      },
    ],
  };
};
