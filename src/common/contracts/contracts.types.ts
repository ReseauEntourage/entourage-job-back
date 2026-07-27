import { FilterConstant } from 'src/utils/types';

export enum Contracts {
  ALTERNANCE = 'alt',
  AUTRE = 'other',
  CDD = 'cdd',
  CDD_MOINS_6 = 'cdd-6',
  CDD_PLUS_6 = 'cdd+6',
  CDDI = 'cddi',
  CDI = 'cdi',
  FORMATION = 'form',
  INTERIM = 'inte',
  PMSMP = 'pmsmp',
  STAGE = 'stage',
}

export const ContractFilters: FilterConstant<Contracts>[] = [
  {
    label: 'CDI',
    value: Contracts.CDI,
    end: false,
  },
  {
    label: 'CDD + de 6 mois',
    value: Contracts.CDD_PLUS_6,
    end: true,
  },
  {
    label: 'CDD - de 6 mois',
    value: Contracts.CDD_MOINS_6,
    end: true,
  },
  {
    label: "Contrat d'insertion",
    value: Contracts.CDDI,
    end: true,
  },
  {
    label: 'Alternance',
    value: Contracts.ALTERNANCE,
    end: true,
  },
  {
    label: 'Intérim',
    value: Contracts.INTERIM,
    end: true,
  },
  {
    label: 'Stage',
    value: Contracts.STAGE,
    end: true,
  },
  {
    label: 'Formation certifiante',
    value: Contracts.FORMATION,
    end: true,
  },
  {
    label: "Période d'immersion (PMSMP)",
    value: Contracts.PMSMP,
    end: true,
  },
  {
    label: 'Autre',
    value: Contracts.AUTRE,
    end: true,
  },
];
