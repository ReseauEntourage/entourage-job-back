import { FilterConstant } from 'src/utils/types';

export enum ContactTypeEnum {
  REMOTE = 'remote',
  PHYSICAL = 'physical',
}

export type HelpValue = 'tips' | 'interview' | 'cv' | 'network' | 'event';

export const HelpFilters: FilterConstant<HelpValue>[] = [
  {
    value: 'tips',
    label: 'Soutien',
  },
  {
    value: 'interview',
    label: 'Entretien',
  },
  {
    value: 'cv',
    label: 'CV',
  },
  {
    value: 'event',
    label: 'Événement',
  },
  {
    value: 'network',
    label: 'Partage',
  },
];
