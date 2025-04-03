import { BusinessSector } from 'src/common/business-sectors/models';
import { Department } from 'src/common/locations/locations.types';
import { Occupation } from 'src/common/occupations/models';
import { UserRole } from 'src/users/users.types';
import { FilterConstant } from 'src/utils/types';
import { HelpNeed, HelpOffer } from './models';

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

export type PublicProfile = {
  id: string;
  firstName: string;
  lastName: string;
  role: UserRole;
  department: Department;
  currentJob: string;
  isAvailable: boolean;
  helpOffers: HelpOffer[];
  helpNeeds: HelpNeed[];
  description: string;
  businessSectors: BusinessSector[];
  occupations: Occupation[];
  lastSentMessage: Date;
  lastReceivedMessage: Date;
  cvUrl?: string;
  linkedinUrl?: string;
  hasExternalCv: boolean;
};
