import { Contract } from 'src/common/contracts/models';
import { Experience } from 'src/common/experiences/models';
import { Formation } from 'src/common/formations/models';
import { Interest } from 'src/common/interests/models';
import { Language } from 'src/common/languages/models';
import { Department } from 'src/common/locations/locations.types';
import { Nudge } from 'src/common/nudge/models';
import { Review } from 'src/common/reviews/models';
import { Skill } from 'src/common/skills/models';
import { UserRole } from 'src/users/users.types';
import { FilterConstant } from 'src/utils/types';
import { UserProfileSectorOccupation } from './models';
import { UserProfileNudge } from './models/user-profile-nudge.model';

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

export type PublicProfile = {
  id: string;
  firstName: string;
  lastName: string;
  role: UserRole;
  department: Department;
  currentJob: string;
  isAvailable: boolean;
  nudges: Nudge[];
  customNudges: UserProfileNudge[];
  introduction: string;
  description: string;
  sectorOccupations: UserProfileSectorOccupation[];
  languages: Language[];
  experiences: Experience[];
  formations: Formation[];
  skills: Skill[];
  contracts: Contract[];
  reviews: Review[];
  interests: Interest[];
  lastSentMessage: Date;
  lastReceivedMessage: Date;
  cvUrl?: string;
  linkedinUrl?: string;
  hasExternalCv: boolean;
  averageDelayResponse: number | null;
};
