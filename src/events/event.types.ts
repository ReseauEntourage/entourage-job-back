import { UserProfile } from 'src/user-profiles/models';
import { User } from 'src/users/models';

/**
 * Event Types Enumeration
 */
export enum EventType {
  APERO_COACH = 'APERO_COACH',
  APERO_ENTOURAGE = 'APERO_ENTOURAGE',
  COFFEE_SESSION = 'COFFEE_SESSION',
  FRIENDLINESS = 'FRIENDLINESS',
  NETWORKING = 'NETWORKING',
  PAPOTAGES_PRO = 'PAPOTAGES_PRO',
  PHOTO_SHOOTING = 'PHOTO_SHOOTING',
  SPEED_MEETING = 'SPEED_MEETING',
  UNKNOWN = 'UNKNOWN',
  WELCOME_SESSION = 'WELCOME_SESSION',
  WORKSHOP = 'WORKSHOP',
}

export enum EventPublicAudience {
  AUTHORITIES = 'Collectivité',
  COMPANIES = 'Entreprises',
  GENERAL_PUBLIC = 'Grand public',
  ORGANIZATIONS = 'Associations',
  SCHOLARS = 'Scolaire',
  YOUNG_PUBLIC = 'Jeunes',
}

export enum SalesforceEventTypes {
  APERO_COACH = 'Apéro coach',
  APERO_ENTOURAGE = 'Apéro Entourage',
  COFFEE_SESSION = 'Info co candidat',
  FRIENDLINESS = 'Evenement de convivialité',
  NETWORKING = 'Atelier Réseau',
  PAPOTAGES_PRO = 'Papotages Pro',
  PHOTO_SHOOTING = 'Séance photo',
  SPEED_MEETING = 'Rencontre Réseau Pro (ex Connecteurs)',
  WELCOME_SESSION = 'Rdv de bienvenue Entourage Pro',
  WORKSHOP = 'Atelier Entourage Pro',
}

/**
 * Event Mode Enumeration
 */
export enum EventMode {
  IRL = 'irl',
  ONLINE = 'online',
}

export interface Event {
  audience?: string;
  description: string;
  duration: number | null;
  endDate: string;
  eventType: EventType;
  format?: string;
  fullAddress: string | null;
  goal?: string;
  image?: string;
  isParticipating: boolean;
  meetingLink: string | null;
  mode: EventMode;
  name: string;
  participantsCount?: number;
  publicSensibilise: EventPublicAudience[] | null;
  registrationCount?: number;
  salesForceId: string;
  sequences?: string[];
  startDate: string;
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
