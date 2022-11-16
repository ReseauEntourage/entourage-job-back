import { BusinessLine } from 'src/common/businessLines/models';
import { ContractValue } from 'src/common/contracts/contracts.types';
import { Department } from 'src/common/locations/locations.types';
import {
  CompanyApproach,
  CompanyApproaches,
  CompanyZone,
  HeardAbout,
  HeardAboutValue,
} from 'src/contacts/contacts.types';
import {
  ExternalOfferOrigin,
  OfferStatus,
} from 'src/opportunities/opportunities.types';
import { AdminZone } from 'src/utils/types';

export const ErrorCodes = {
  DUPLICATES_DETECTED: 'DUPLICATES_DETECTED',
} as const;

export type ErrorCode = typeof ErrorCodes[keyof typeof ErrorCodes];

export interface SalesforceError {
  errorCode: ErrorCode;
  message: string;
  duplicateResut: {
    matchResults: {
      matchRecords: {
        record: {
          Id: string;
        };
      }[];
    }[];
  };
}

export const ObjectNames = {
  COMPANY: 'Account',
  LEAD: 'Lead',
  PROCESS: 'Processus_d_offres__c',
  OFFER: 'Offre_d_emploi__c',
  CONTACT: 'Contact',
  BINOME: 'Binome__c',
} as const;

export type ObjectName = typeof ObjectNames[keyof typeof ObjectNames];

type SalesforceObjects = {
  [ObjectNames.COMPANY]: SalesforceCompany;
  [ObjectNames.LEAD]: SalesforceLead;
  [ObjectNames.PROCESS]: SalesforceProcess;
  [ObjectNames.OFFER]: SalesforceOffer;
  [ObjectNames.CONTACT]: SalesforceContact;
  [ObjectNames.BINOME]: SalesforceBinome;
};

export type SalesforceObject<T extends ObjectName> = SalesforceObjects[T];

export const ContactsRecordTypesIds = {
  COACH: '0127Q000000Ub9wQAC',
  CANDIDATE: '0127Q000000UbNVQA0',
  COMPANY: '0127Q000000Uhq0QAC',
  ASSOCIATION: '0127Q000000Uhq0QAC',
} as const;

export type ContactRecordType =
  typeof ContactsRecordTypesIds[keyof typeof ContactsRecordTypesIds];

export const LeadsRecordTypesIds = {
  COACH: '0127Q000000UbQPQA0',
  CANDIDATE: '0127Q000000UbQKQA0',
  COMPANY: '0127Q000000ThTsQAK',
  ASSOCIATION: '0127Q000000Thz9QAC',
} as const;

export type LeadRecordType =
  typeof LeadsRecordTypesIds[keyof typeof LeadsRecordTypesIds];

export const LeadApproaches: { [K in CompanyApproach]: string } = {
  [CompanyApproaches.DONATION]: 'Soutenir le projet (mécénat)',
  [CompanyApproaches.INFORMATION]: "Avoir plus d'informations sur LinkedOut",

  [CompanyApproaches.MOBILIZATION]: 'Mobiliser des collaborateurs',
  [CompanyApproaches.RECRUITMENT]: 'Recruter inclusif',
} as const;

export const LeadHeardAbout: { [K in HeardAboutValue]: string } = {
  [HeardAbout.COMPANY]: 'Mon entreprise',
  [HeardAbout.ENTOURAGE]: 'Le réseau Entourage (newsletter, application...)',
  [HeardAbout.PRESS]: 'Un article dans la presse, une newsletter',
  [HeardAbout.LINKEDIN]: 'LinkedIn',
  [HeardAbout.SOCIAL]: 'Autres réseaux (facebook, twitter, instagram...)',
  [HeardAbout.SPORTS]: 'Partenariat_Sport',
  [HeardAbout.VOLUNTEER]: 'Un site de bénévolat',
  [HeardAbout.CONTACT]: 'Le bouche à oreille',
  [HeardAbout.OTHER]: 'Autre',
} as const;

export interface SalesforceBinome {
  Id?: string;
}

export interface OfferAndProcessProps {
  offer: OfferProps;
  process: ProcessProps[];
}

export interface ProcessProps {
  id: string;
  firstName: string;
  lastName: string;
  company: string;
  isPublic: boolean;
  status: OfferStatus;
  seen: boolean;
  bookmarked: boolean;
  archived: boolean;
  recommended: boolean;
  offerTitle: string;
  offerId?: string;
  binomeSfId?: string;
  offerSfId?: string;
}

export interface SalesforceProcess {
  Id?: string;
  ID_Externe__c: string;
  Name: string;
  Statut__c: string;
  Vue__c: boolean;
  Favoris__c: boolean;
  Archivee__c: boolean;
  Recommandee__c: boolean;
  Binome__c: string;
  Offre_d_emploi__c: string;
}

export interface OfferProps {
  id: string;
  company: string;
  title: string;
  businessLines: BusinessLine[];
  contract: ContractValue;
  isPartTime: boolean;
  isPublic: boolean;
  isExternal: boolean;
  link: string;
  isValidated: boolean;
  isArchived: boolean;
  department: Department;
  address: string;
  workingHours: string;
  salary: string;
  message: string;
  companyDescription: string;
  description: string;
  otherInfo: string;
  driversLicense: boolean;
  externalOrigin: ExternalOfferOrigin;
  recruiterFirstName: string;
  recruiterName: string;
  recruiterMail: string;
  recruiterPhone: string;
  recruiterPosition: string;
  contactMail: string;
  companySfId?: string;
  contactSfId?: string;
}

export interface SalesforceOffer {
  Id?: string;
  ID__c: string;
  Name: string;
  Titre__c: string;
  Entreprise_Recruteuse__c: string;
  Secteur_d_activite_de_l_offre__c: string;
  Type_de_contrat__c: string;
  Temps_partiel__c: boolean;
  Offre_publique__c: boolean;
  Offre_externe__c: boolean;
  Offre_archivee__c: boolean;
  Offre_valid_e__c: boolean;
  Lien_externe__c: string;
  Lien_Offre_Backoffice__c: string;
  Departement__c: string;
  Adresse_de_l_offre__c: string;
  Jours_et_horaires_de_travail__c: string;
  Salaire_et_complement__c: string;
  Message_au_candidat__c: string;
  Presentation_de_l_entreprise__c: string;
  Descriptif_des_missions_proposees__c: string;
  Autre_precision_sur_votre_besoin__c: string;
  Permis_de_conduire_necessaire__c: boolean;
  Source_de_l_offre__c: string;
  Nom__c: string;
  Prenom__c: string;
  Mail_du_recruteur__c: string;
  Telephone_du_recruteur__c: string;
  Fonction_du_recruteur__c: string;
  Mail_de_contact__c: string;
  Prenom_Nom_du_recruteur__c: string;
  Contact_cree_existant__c: true;
  Antenne__c: string;
}

export interface CompanyProps {
  name: string;
  businessLines: BusinessLine[];
  address: string;
  department: Department;
  mainCompanySfId: string;
}

export interface SalesforceCompany {
  Id?: string;
  Name: string;
  Industry: string;
  BillingStreet: string;
  BillingCity: string;
  BillingPostalCode: string;
  Reseaux__c: 'LinkedOut';
  Antenne__c: string;
  ParentId: string;
}

export interface ContactProps {
  firstName?: string;
  lastName: string;
  email: string;
  phone?: string;
  position?: string;
  department: Department;
  companySfId: string;
}

export interface SalesforceContact {
  Id?: string;
  LastName: string;
  FirstName: string;
  Email: string;
  Phone: string;
  Title: string;
  AccountId: string;
  Type_de_contact__c: 'Entreprise';
  Reseaux__c: 'LinkedOut';
  RecordTypeId: ContactRecordType;
  Antenne__c?: string;
}

export interface LeadProps {
  firstName: string;
  lastName: string;
  company: string;
  email: string;
  phone?: string;
  approach: CompanyApproach;
  zones: CompanyZone[];
  heardAbout?: HeardAboutValue;
}

export interface SalesforceLead {
  Id?: string;
  LastName: string;
  FirstName: string;
  Company: string;
  Email: string;
  Phone?: string;
  Reseaux__c: 'LinkedOut';
  RecordTypeId: LeadRecordType;
  Antenne__c: string;
  Votre_demarche__c: string;
  Comment_vous_nous_avez_connu__c: string;
  Source__c: 'Lead entrant';
}
