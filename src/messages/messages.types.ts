import { FilterConstant } from 'src/utils/types';

export const ContactTypes = {
  CONNECTOR: 'connector',
} as const;

export type ContactType = typeof ContactTypes[keyof typeof ContactTypes];

export const ContactTypeFilters: FilterConstant<ContactType>[] = [
  {
    label: 'Connecteur',
    value: ContactTypes.CONNECTOR,
  },
];
