import { FilterConstant } from 'src/utils/types';

export const CVStatuses = {
  Published: {
    label: 'Publié',
    value: 'Published',
    style: 'success',
  },
  Pending: {
    label: 'En attente',
    value: 'Pending',
    style: 'danger',
  },
  Progress: {
    label: 'En cours',
    value: 'Progress',
    style: 'muted',
  },
  New: {
    label: 'Nouveau',
    value: 'New',
    style: 'muted',
  },
  Draft: {
    label: 'Brouillon',
    value: 'Draft',
    style: 'warning',
  },
  Unknown: {
    label: 'Inconnu',
    value: 'Unknown',
    style: '',
  },
} as const;

export type CVStatusKey = keyof typeof CVStatuses;
type CVStatus = typeof CVStatuses[CVStatusKey];
export type CVStatusValue = CVStatus['value'];

export const CVStatusFilters: FilterConstant<CVStatusValue>[] = [
  CVStatuses.Published,
  CVStatuses.Pending,
  CVStatuses.Progress,
  CVStatuses.New,
];
