import { SlackBlockConfig } from 'src/external-services/slack/slack.types';
import { User } from 'src/users/models';
import { Company } from './models/company.model';

export const generateSlackMsgConfigNewCompany = (
  company: Company,
  user: Pick<User, 'email' | 'firstName' | 'lastName'>,
  referentSlackUserId: string | null
): SlackBlockConfig => {
  return {
    title: '🏢 Une nouvelle entreprise a été créée',
    context: [
      {
        title: "Utilisateur ayant créé l'entreprise",
        content: `${user.firstName} ${user.lastName} <${user.email}>`,
      },
      ...(referentSlackUserId
        ? [
            {
              title: 'Référent Slack',
              content: `<@${referentSlackUserId}>`,
            },
          ]
        : []),
    ],
    msgParts: [
      {
        content: `*ID de l'entreprise* : ${company.id}`,
      },
      {
        content: `*Nom de l'entreprise* : ${company.name}`,
      },
      {
        content:
          'Cette entreprise a été créée, merci de vérifier ses informations.',
      },
    ],
  };
};
