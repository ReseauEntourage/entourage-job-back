import { Op } from 'sequelize';
import {
  BusinessLineFilters,
  BusinessLineValue,
} from 'src/common/business-lines/business-lines.types';
import {
  ContractFilters,
  ContractValue,
} from 'src/common/contracts/contracts.types';
import {
  Department,
  DepartmentFilters,
} from 'src/common/locations/locations.types';
import { AdminZones, FilterConstant, Filters } from 'src/utils/types';
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
  contracts: { [Op.or]: ContractValue[] };
}

export type OfferFilterKey = keyof OfferOptions;

export const OfferAdminTabs = {
  PENDING: 'pending',
  VALIDATED: 'validated',
  EXTERNAL: 'external',
  ARCHIVED: 'archived',
} as const;

type OfferAdminTabKey = keyof typeof OfferAdminTabs;
export type OfferAdminTab = typeof OfferAdminTabs[OfferAdminTabKey];

export const OfferCandidateTypes = {
  PUBLIC: 'public',
  PRIVATE: 'private',
} as const;

type OfferCandidateTypeKey = keyof typeof OfferCandidateTypes;
export type OfferCandidateType =
  typeof OfferCandidateTypes[OfferCandidateTypeKey];
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
  {
    key: 'contracts',
    constants: ContractFilters,
    title: 'Type de contrat',
  },
];

export type OpportunityRestricted = Opportunity & {
  opportunityUsers: OpportunityUser;
};

export const EventTypes = {
  CONTACT: 'contact',
  FOLLOWUP: 'followup',
  INTERVIEW: 'interview',
  TRIAL: 'trial',
  PMSMP: 'pmsmp',
  HIRING: 'hiring',
  END: 'end',
} as const;

export type EventType = typeof EventTypes[keyof typeof EventTypes];

export const EventTypeFilters: FilterConstant<EventType>[] = [
  {
    label: 'Contacte',
    value: 'contact',
  },
  {
    label: 'Relance',
    value: 'followup',
  },
  {
    label: 'Entretien',
    value: 'interview',
  },
  {
    label: "Période d'essai ",
    value: 'trial',
  },
  {
    label: 'PMSMP',
    value: 'pmsmp',
  },
  {
    label: 'Embauche',
    value: 'hiring',
  },
  {
    label: 'Arrêt de contrat',
    value: 'end',
  },
];
