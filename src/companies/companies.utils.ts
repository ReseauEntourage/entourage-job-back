import { SlackBlockConfig } from 'src/external-services/slack/slack.types';
import { User } from 'src/users/models';
import { CompanyCreationContext } from './companies.types';
import { Company } from './models/company.model';

export const companyCreationContextVerbose = {
  [CompanyCreationContext.UNKNOWN]: 'Inconnu',
  [CompanyCreationContext.REGISTRATION]: "Formulaire d'inscription",
  [CompanyCreationContext.COACH_LINKING]:
    'Déclaration "Entreprise actuelle" en tant que coach',
};

export const generateSlackMsgConfigNewCompany = (
  company: Company,
  user: Pick<User, 'email' | 'firstName' | 'lastName'>,
  referentSlackUserId: string | null,
  context: CompanyCreationContext = CompanyCreationContext.UNKNOWN
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
        content: `*Contexte de création* : ${companyCreationContextVerbose[context]}`,
      },
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
