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
  COFFEE_SESSION = 'Café d’information',
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
  participantsCount?: number;
  mode: EventMode;
  meetingLink: string | null;
  image?: string;
  fullAddress: string | null;
  duration: number | null;
  format?: string;
  goal?: string;
  audience?: string;
  sequences?: string[];
}

export type Events = Event[];
