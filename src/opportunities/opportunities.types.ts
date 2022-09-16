import { Op } from 'sequelize';
import {
  BusinessLineFilters,
  BusinessLineValue,
} from 'src/businessLines/businessLines.types';
import { Department, DepartmentFilters } from 'src/locations/locations.types';
import {
  AdminZones,
  FilterConstant,
  Filters,
  TabFilters,
} from 'src/utils/types';
import { Opportunity, OpportunityUser } from './models';

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
  TO_PROCESS: {
    value: -1,
    label: 'Offre à traiter',
    public: 'Offre consultée',
    recommended: 'Offre recommandée',
    color: 'muted',
  },
  CONTACTED: { value: 0, label: 'Contacté', color: 'muted' },
  INTERVIEW: { value: 1, label: "Phase d'entretien", color: 'warning' },
  HIRED: { value: 2, label: 'Embauche', color: 'success' },
  REFUSAL_BEFORE_INTERVIEW: {
    value: 3,
    label: 'Refus avant entretien',
    color: 'danger',
  },
  REFUSAL_AFTER_INTERVIEW: {
    value: 4,
    label: 'Refus après entretien',
    color: 'danger',
  },
} as const;

type OfferStatusKey = keyof typeof OfferStatuses;
export type OfferStatus = typeof OfferStatuses[OfferStatusKey]['value'];

export const OfferStatusFilters: FilterConstant<OfferStatus>[] = [
  OfferStatuses.TO_PROCESS,
  OfferStatuses.CONTACTED,
  OfferStatuses.INTERVIEW,
  OfferStatuses.HIRED,
  OfferStatuses.REFUSAL_BEFORE_INTERVIEW,
  OfferStatuses.REFUSAL_AFTER_INTERVIEW,
];

export interface OfferOptions {
  isPublic: { [Op.or]: boolean[] };
  status: { [Op.or]: OfferStatus[] };
  businessLines: { [Op.or]: BusinessLineValue[] };
  department: { [Op.or]: Department[] };
}

export type OfferFilterKey = keyof OfferOptions;

export const OfferCandidateTabs = {
  PRIVATE: 'private',
  PUBLIC: 'public',
  ARCHIVED: 'archived',
} as const;

type OfferCandidateTabKey = keyof typeof OfferCandidateTabs;
export type OfferCandidateTab = typeof OfferCandidateTabs[OfferCandidateTabKey];

export const OfferCandidateTabFilters: TabFilters<OfferCandidateTab> = [
  { tag: 'private', title: 'Offres personnelles', active: true },
  { tag: 'public', title: 'Offres générales' },
  { tag: 'archived', title: 'Offres archivées' },
];

export const OfferAdminTabs = {
  PENDING: 'pending',
  VALIDATED: 'validated',
  EXTERNAL: 'external',
  ARCHIVED: 'archived',
} as const;

type OfferAdminTabKey = keyof typeof OfferAdminTabs;
export type OfferAdminTab = typeof OfferAdminTabs[OfferAdminTabKey];

export const OfferAdminTabFilters: TabFilters<OfferAdminTab> = [
  { tag: 'pending', title: 'Offres à valider' },
  { tag: 'validated', title: 'Offres publiées', active: true },
  { tag: 'external', title: 'Offres externes' },
  { tag: 'archived', title: 'Offres archivées' },
];

export const OfferFilters: Filters<OfferFilterKey> = [
  {
    key: 'isPublic',
    constants: [
      { label: 'Offres privées', value: false },
      { label: 'Offres générales', value: true },
    ],
    title: 'Privée/générale',
  },
  {
    key: 'status',
    constants: OfferStatusFilters,
    title: 'Statut',
  },
  {
    key: 'department',
    constants: DepartmentFilters,
    priority: DepartmentFilters.filter((dept) => {
      return dept.zone !== AdminZones.HZ;
    }),
    title: 'Département',
  },
  {
    key: 'businessLines',
    constants: BusinessLineFilters,
    title: 'Métiers',
  },
];

export type OpportunityRestricted = Opportunity & {
  opportunityUsers: OpportunityUser;
};
