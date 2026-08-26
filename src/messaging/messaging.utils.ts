import { SlackBlockConfig } from 'src/external-services/slack/slack.types';
import { User } from 'src/users/models';
import { ErrorMessagingMailingListInvalid } from './messaging.errors';
import { Conversation } from './models';

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
