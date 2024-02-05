import { Ambition } from 'src/common/ambitions/models';
import { BusinessLine } from 'src/common/business-lines/models';
import { Department } from 'src/common/locations/locations.types';
import { UserRole } from 'src/users/users.types';
import { HelpOffer } from './models';

export type HelpValue = 'tips' | 'interview' | 'cv' | 'network' | 'event';

export type PublicProfile = {
  id: string;
  firstName: string;
  lastName: string;
  role: UserRole;
  department: Department;
  currentJob: string;
  helpOffers: HelpOffer[];
  helpNeeds: HelpOffer[];
  description: string;
  searchBusinessLines: BusinessLine[];
  networkBusinessLines: BusinessLine[];
  searchAmbitions: Ambition[];
  lastSentMessage: Date;
  lastReceivedMessage: Date;
};
