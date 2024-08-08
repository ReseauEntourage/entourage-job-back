import { SlackBlockConfig } from 'src/external-services/slack/slack.types';
import { User } from 'src/users/models';
import { InternalMessage } from './models';

export const forbiddenExpressions = [
  'compte bancaire',
  'coordonnées bancaires',
  'carte d’identité',
  'carte vitale',
  'numéro de sécurité social',
  'passeport',
  'titre de séjour',
  'chez moi',
  'sexe',
  'politique',
  'carte de résident',
  'visa',
  'attestation',
  'récépissé',
  'mot de passe',
  'porno',
  'complément de revenu',
  'banque',
  'de bonne renommée',
  'collecter les loyers',
  'vous serez à mon service',
  ' CB ', // spaces added to exclude words with `cb` inside
  'carte bleu',
  'carte bleue',
];

export const forbiddenExpressionsInMessage = (message: string): string[] => {
  return forbiddenExpressions.filter((expression) =>
    message.toLowerCase().includes(expression)
  );
};

export const generateSlackMsgConfigSuspiciousMessageDetected = (
  message: InternalMessage,
  senderUser: User,
  addresseeUser: User,
  forbiddenExpressionsFound: string[]
): SlackBlockConfig => {
  const adminConfirmSendMessageUrl = `${process.env.FRONT_URL}/backoffice/admin/internal-messages/${message.id}/re-send`;

  return {
    title: '🚨 Message suspect détecté sur Entourage-Pro 🚨',
    context: [
      {
        imageUrl:
          'https://api.slack.com/img/blocks/bkb_template_images/notificationsWarningIcon.png',
        altText: 'warning icon',
      },
      {
        title: 'Status',
        content:
          "*Le message n'a pas été envoyé à son destinataire car il contenait des mots interdits*",
      },
      {
        title: 'Mots interdits',
        content: forbiddenExpressionsFound.join(', '),
      },
    ],
    msgParts: [
      {
        content: `*Expéditeur :*\n${senderUser.email}`,
      },
      {
        content: `*Destinataire :*\n${addresseeUser.email}`,
      },
      {
        content: `*Objet : ${message.subject}*`,
      },
      {
        content: `*Message* :\n${message.message}`,
      },
    ],
    actions: [
      {
        label: 'Réenvoyer dans le backoffice',
        url: adminConfirmSendMessageUrl,
        value: 'resend-internal-message',
      },
    ],
  };
};

export const generateSlackMsgConfigMessageResent = (
  internalMessage: InternalMessage,
  adminUser: User,
  senderUser: User,
  addresseeUser: User
): SlackBlockConfig => {
  return {
    title: '✅ Un message interne a été réenvoyé par un administrateur',
    context: [
      {
        title: 'Administrateur',
        content: `${adminUser.firstName} ${adminUser.lastName} (${adminUser.email})`,
      },
      {
        title: 'InternalMessageId',
        content: internalMessage.id,
      },
    ],
    msgParts: [
      {
        content: `*Expéditeur*\n${senderUser.email}`,
      },
      {
        content: `*Destinataire*\n${addresseeUser.email}`,
      },
    ],
  };
};
