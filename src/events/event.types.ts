import { UserProfile } from 'src/user-profiles/models';
import { User } from 'src/users/models';

/**
 * Event Types Enumeration
 */
export enum EventType {
  UNKNOWN = 'UNKNOWN',
  WELCOME_SESSION = 'WELCOME_SESSION',
  COFFEE_SESSION = 'COFFEE_SESSION',
  NETWORKING = 'NETWORKING',
  SPEED_MEETING = 'SPEED_MEETING',
  PAPOTAGES_PRO = 'PAPOTAGES_PRO',
  PHOTO_SHOOTING = 'PHOTO_SHOOTING',
  APERO_COACH = 'APERO_COACH',
}

export enum SalesforceEventTypes {
  WELCOME_SESSION = 'Rdv de bienvenue Entourage Pro',
  COFFEE_SESSION = 'Info co candidat',
  NETWORKING = 'Atelier Réseau',
  SPEED_MEETING = 'Rencontre Réseau Pro (ex Connecteurs)',
  PAPOTAGES_PRO = 'Papotages Pro',
  PHOTO_SHOOTING = 'Séance photo',
  APERO_COACH = 'Apéro coach',
}

/**
 * Event Mode Enumeration
 */
export enum EventMode {
  ONLINE = 'online',
  IRL = 'irl',
}

export interface Event {
  salesForceId: string;
  name: string;
  description: string;
  startDate: string;
  endDate: string;
  eventType: EventType;
  registrationCount?: number;
  participantsCount?: number;
  mode: EventMode;
  meetingLink: string | null;
  image?: string;
  fullAddress: string | null;
  duration: number | null;
  format: string;
  goal: string;
  audience: string;
  sequences?: string[];
  isParticipating: boolean;
}

export type EventParticipant = Pick<
  User,
  'id' | 'firstName' | 'lastName' | 'role'
> & {
  userProfile: Pick<UserProfile, 'id' | 'hasPicture'>;
};

export interface EventWithParticipants extends Event {
  participants: EventParticipant[];
}

export type Events = Event[];
