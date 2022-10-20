import { FilterConstant } from 'src/utils/types';

export type HeardAbout =
  | 'contact'
  | 'search'
  | 'socialAdd'
  | 'otherAdd'
  | 'press'
  | 'other';

export const HeardAboutFilters: FilterConstant<HeardAbout>[] = [
  {
    label: 'Par un de mes contacts',
    value: 'contact',
  },
  {
    label: 'Recherche internet',
    value: 'search',
  },
  {
    label: 'Publicité sur les réseaux sociaux',
    value: 'socialAdd',
  },
  {
    label: 'Autre publicité',
    value: 'otherAdd',
  },
  {
    label: 'Press',
    value: 'press',
  },
  {
    label: 'Autre',
    value: 'other',
  },
];
