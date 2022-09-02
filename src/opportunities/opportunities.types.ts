import { FilterConstant } from 'src/utils/types';

export type ExternalOfferOrigin = 'network' | 'internet' | 'counselor';

export const ExternalOfferOriginFilters: FilterConstant<ExternalOfferOrigin>[] =
  [
    {
      label: 'Mon réseau',
      salesforceLabel: 'Réseau du candidat',
      value: 'network',
    },
    {
      label: 'Recherches Internet',
      salesforceLabel: 'Recherche Internet',
      value: 'internet',
    },
    {
      label: 'Mon conseiller emploi (Pôle Emploi, mission locale...)',
      salesforceLabel: 'Avec Pôle Emploi',
      value: 'counselor',
    },
  ];

export const OfferStatuses = {
  ToProcess: {
    value: -1,
    label: 'Offre à traiter',
    public: 'Offre consultée',
    recommended: 'Offre recommandée',
    color: 'muted',
  },
  Contacted: { value: 0, label: 'Contacté', color: 'muted' },
  Interview: { value: 1, label: "Phase d'entretien", color: 'warning' },
  Hired: { value: 2, label: 'Embauche', color: 'success' },
  RefusalBeforeInterview: {
    value: 3,
    label: 'Refus avant entretien',
    color: 'danger',
  },
  RefusalAfterInterview: {
    value: 4,
    label: 'Refus après entretien',
    color: 'danger',
  },
} as const;

type OfferStatusKey = keyof typeof OfferStatuses;
export type OfferStatus = typeof OfferStatuses[OfferStatusKey]['value'];

export const OfferStatusFilters: FilterConstant<OfferStatus>[] = [
  OfferStatuses.ToProcess,
  OfferStatuses.Contacted,
  OfferStatuses.Interview,
  OfferStatuses.Hired,
  OfferStatuses.RefusalBeforeInterview,
  OfferStatuses.RefusalAfterInterview,
];
