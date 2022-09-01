import { FilterConstant } from 'src/utils/types';

export type Contract =
  | 'cdi'
  | 'cdd'
  | 'cdd+6'
  | 'cdd-6'
  | 'cddi'
  | 'alt'
  | 'inte'
  | 'stage'
  | 'form'
  | 'pmsmp'
  | 'other';

export const ContractFilters: FilterConstant<Contract>[] = [
  {
    label: 'CDI',
    value: 'cdi',
    end: false,
  },
  {
    label: 'CDD + de 6 mois',
    value: 'cdd+6',
    end: true,
  },
  {
    label: 'CDD - de 6 mois',
    value: 'cdd-6',
    end: true,
  },
  {
    label: "Contrat d'insertion",
    value: 'cddi',
    end: true,
  },
  {
    label: 'Alternance',
    value: 'alt',
    end: true,
  },
  {
    label: 'Intérim',
    value: 'inte',
    end: true,
  },
  {
    label: 'Stage',
    value: 'stage',
    end: true,
  },
  {
    label: 'Formation certifiante',
    value: 'form',
    end: true,
  },
  {
    label: "Période d'immersion (PMSMP)",
    value: 'pmsmp',
    end: true,
  },
  {
    label: 'Autre',
    value: 'other',
    end: true,
  },
];
