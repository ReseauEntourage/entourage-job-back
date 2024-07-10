import { Ambition } from 'src/common/ambitions/models';
import { BusinessLine } from 'src/common/business-lines/models';
import { Department } from 'src/common/locations/locations.types';
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
  searchBusinessLines: BusinessLine[];
  networkBusinessLines: BusinessLine[];
  searchAmbitions: Ambition[];
  lastSentMessage: Date;
  lastReceivedMessage: Date;
  cvUrl?: string;
  linkedinUrl?: string;
  gotExternalCv: boolean;
};
