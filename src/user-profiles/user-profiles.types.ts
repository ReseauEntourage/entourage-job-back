import { FilterConstant } from 'src/utils/types';

export enum ContactTypeEnum {
  PHYSICAL = 'physical',
  REMOTE = 'remote',
}

export type HelpValue = 'tips' | 'interview' | 'cv' | 'network';

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
    value: 'network',
    label: 'Partage',
  },
];
