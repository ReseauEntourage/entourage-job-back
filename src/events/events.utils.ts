import { SalesforceCampaign } from 'src/external-services/salesforce/salesforce.types';
import {
  Event,
  EventMode,
  EventType,
  SalesforceEventTypes,
} from './event.types';

/**
 * Attributes to fetch from Salesforce for Event Campaigns
 */
export const salesforceEventAttributes = [
  'Id',
  'Name',
  'Description',
  'StartDate',
  'Heure_de_d_but__c',
  'EndDate',
  'Heure_de_fin__c',
  'Type_evenement__c',
  'Antenne__c',
  'Adresse_de_l_v_nement__c',
  'En_ligne__c',
  'Nombre_d_inscrits__c',
  'MeetingLink__c',
];

/**
 * Mapping from Salesforce Event Type to internal EventType
 */
export const salesforceEventTypeToEventType: { [key: string]: EventType } = {
  [SalesforceEventTypes.WELCOME_SESSION]: EventType.WELCOME_SESSION,
  [SalesforceEventTypes.COFFEE_SESSION]: EventType.COFFEE_SESSION,
  [SalesforceEventTypes.NETWORKING]: EventType.NETWORKING,
  [SalesforceEventTypes.SPEED_MEETING]: EventType.SPEED_MEETING,
  [SalesforceEventTypes.PAPOTAGES_PRO]: EventType.PAPOTAGES_PRO,
  [SalesforceEventTypes.PHOTO_SHOOTING]: EventType.PHOTO_SHOOTING,
  [SalesforceEventTypes.APERO_COACH]: EventType.APERO_COACH,
};

export const eventTypeToSalesforceEventType: { [key in EventType]: string } = {
  [EventType.WELCOME_SESSION]: SalesforceEventTypes.WELCOME_SESSION,
  [EventType.COFFEE_SESSION]: SalesforceEventTypes.COFFEE_SESSION,
  [EventType.NETWORKING]: SalesforceEventTypes.NETWORKING,
  [EventType.SPEED_MEETING]: SalesforceEventTypes.SPEED_MEETING,
  [EventType.PAPOTAGES_PRO]: SalesforceEventTypes.PAPOTAGES_PRO,
  [EventType.PHOTO_SHOOTING]: SalesforceEventTypes.PHOTO_SHOOTING,
  [EventType.APERO_COACH]: SalesforceEventTypes.APERO_COACH,
  [EventType.UNKNOWN]: 'Inconnu',
};

/**
 * Additional attributes for specific Event Types
 */
export const additionalEventAttributesByEventType: {
  [key: string]: Pick<Event, 'format' | 'goal' | 'audience' | 'sequences'>;
} = {
  // Webinaire tout savoir sur Entourage pro
  [EventType.WELCOME_SESSION]: {
    format: 'Webinaire - En ligne',
    goal: 'Comprendre le fonctionnement d’Entourage Pro et permettre une première prise en main de la plateforme.',
    audience: 'Candidats et coachs de toute la France',
    sequences: [
      'Accueil et tour de table',
      'Présentation d’Entourage Pro',
      'Démonstration de la plateforme Entourage Pro',
      'Conseils pour démarrer avec Entourage Pro',
      'Temps de questions et réponses',
    ],
  },

  // Le café Entourage pro
  [EventType.COFFEE_SESSION]: {
    format: 'En présentiel à Paris, Rennes, Lille et Lyon.',
    goal: 'Comprendre le fonctionnement d’Entourage Pro et permettre une première prise en main de la plateforme.',
    audience: 'Candidats et coachs qui le souhaitent des régions concernées',
    sequences: [
      'Accueil et tour de table de présentation',
      'Présentation d’Entourage Pro et de la plateforme',
      'Temps d’échanges autour de la recherche d’emploi de chacun et chacune',
    ],
  },

  // L’atelier réseau
  [EventType.NETWORKING]: {
    format: 'En présentiel à Paris, Rennes, Lille et Lyon.',
    goal: 'Comprendre ce qu’est le réseau, comment l’identifier, l’activer et le cultiver.',
    audience: 'Candidats et coachs des régions concernées.',
    sequences: [
      'Accueil et tour de table',
      'Comprendre comment identifier son réseau',
      'Apprendre à solliciter son réseau',
      'Savoir cultiver son réseau',
      'Echanges et conclusion',
    ],
  },

  // La rencontre réseau
  [EventType.SPEED_MEETING]: {
    format: 'En présentiel à Paris, Rennes, Lille et Lyon.',
    goal: 'Permettre aux coachs et candidats de se rencontrer sous forme de “speed meeting” pour échanger autour de la recherche d’emploi et créer des premières opportunités.',
    audience: 'Candidats et coachs des régions concernées.',
    sequences: [
      'Accueil et tour de table',
      'Présentation de l’atelier et de ses objectifs',
      'Répartition en petits groupes (coachs/candidats) pour le speed meeting',
      'Conclusion et temps d’échanges informels',
    ],
  },

  // Les papotages pro
  [EventType.PAPOTAGES_PRO]: {
    format: 'En ligne - Partout en France',
    goal: 'Permettre la rencontre et les échanges entre coachs et candidats autour du réseau pro.',
    audience: 'Candidats et coachs de toute la France.',
    sequences: [
      'Accueil et tour de table',
      'Présentation des objectifs des papotages pro',
      'Répartition de coachs et candidats dans des salles virtuelles pour échanger en petits groupes mixtes coachs/candidats',
    ],
  },

  // Le shooting photo
  [EventType.PHOTO_SHOOTING]: {
    format: 'En présentiel à Paris, Rennes, Lille et Lyon.',
    goal: 'Faire des photos de CV, rencontrer les équipes d’Entourage Pro et les autres candidats.',
    audience: 'Candidats des régions concernées.',
    sequences: [
      'Accueil et tour de table',
      'Présentation du déroulé de la séance',
      'Shooting photo',
      'Pendant que des candidats se font photographier, l’équipe d’Entourage pro en profite pour remonter l’utilisation de la plateforme aux autres candidats et répondre aux questions.',
      'Une photo de groupe pour un joli souvenir !',
    ],
  },

  // Apéro coach
  [EventType.APERO_COACH]: {
    format: 'En présentiel à Paris, Rennes, Lille et Lyon.',
    goal: 'Se rencontrer entre coachs de sa région pour partager autour de la mission et créer une dynamique de communauté.',
    audience: 'Les coachs des régions concernées.',
    sequences: [
      'Accueil',
      'Icebreaker',
      'Explication de ce temps convivial',
      'Libre échanges discussions',
    ],
  },
};

/**
 * Compute Event Mode from Salesforce Campaign
 * @param campaign SalesforceCampaign
 * @returns EventMode
 */
export const computeModeFromSalesforceCampaign = (
  campaign: SalesforceCampaign
): EventMode => {
  return campaign.En_ligne__c === 'Oui' ? EventMode.ONLINE : EventMode.IRL;
};

/**
 * Compute Event Duration (in minutes) from Salesforce Campaign
 */
export const computeEventDurationFromSalesforceCampaign = (
  campaign: SalesforceCampaign
): number | null => {
  // Use the date and time fields to compute duration in minutes
  if (
    campaign.StartDate &&
    campaign.Heure_de_d_but__c &&
    campaign.EndDate &&
    campaign.Heure_de_fin__c
  ) {
    const start = new Date(
      `${campaign.StartDate}T${campaign.Heure_de_d_but__c}`
    );
    const end = new Date(`${campaign.EndDate}T${campaign.Heure_de_fin__c}`);
    const durationMs = end.getTime() - start.getTime();
    return Math.floor(durationMs / 60000);
  }
  return null;
};

/**
 * Convert Salesforce Campaign to internal Event representation
 * @param campaign SalesforceCampaign
 * @returns Event
 */
export const convertSalesforceCampaignToEvent = (
  campaign: SalesforceCampaign
): Event | null => {
  const eventType =
    campaign.Type_evenement__c in salesforceEventTypeToEventType
      ? salesforceEventTypeToEventType[campaign.Type_evenement__c]
      : EventType.UNKNOWN;

  if (eventType === EventType.UNKNOWN) {
    return null;
  }
  return {
    salesForceId: campaign.Id,
    name: campaign.Name,
    description: campaign.Description,
    startDate:
      campaign.StartDate && campaign.Heure_de_d_but__c
        ? `${campaign.StartDate}T${campaign.Heure_de_d_but__c}`
        : null,
    endDate:
      campaign.EndDate && campaign.Heure_de_fin__c
        ? `${campaign.EndDate}T${campaign.Heure_de_fin__c}`
        : null,
    eventType,
    participantsCount: campaign.Nombre_d_inscrits__c,
    meetingLink: campaign.MeetingLink__c || null,
    fullAddress: campaign.Adresse_de_l_v_nement__c || null,
    mode: computeModeFromSalesforceCampaign(campaign),
    duration: computeEventDurationFromSalesforceCampaign(campaign),
    ...additionalEventAttributesByEventType[eventType],
  };
};
