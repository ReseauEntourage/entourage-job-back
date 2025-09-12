import { IncludeOptions } from 'sequelize';

// Définition des inclusions pour les requêtes RecruitementAlert
export const RecruitementAlertInclude: IncludeOptions[] = [
  {
    association: 'businessSectors',
  },
  {
    association: 'skills',
  },
  {
    association: 'company',
    include: [
      {
        association: 'companyUsers',
      },
    ],
  },
];
