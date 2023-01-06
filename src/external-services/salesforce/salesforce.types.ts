import { AnyCantFix } from '../../utils/types';
import { BusinessLine } from 'src/common/businessLines/models';
import { ContractValue } from 'src/common/contracts/contracts.types';
import { Department } from 'src/common/locations/locations.types';
import {
  CandidateAccommodation,
  CandidateAccommodations,
  CandidateAdministrativeSituation,
  CandidateAdministrativeSituations,
  CandidateNationalities,
  CandidateNationality,
  CandidateYesNo,
  CandidateYesNoValue,
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

export const ErrorCodes = {
  DUPLICATES_DETECTED: 'DUPLICATES_DETECTED',
  CANNOT_UPDATE_CONVERTED_LEAD: 'CANNOT_UPDATE_CONVERTED_LEAD',
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

type SalesforceObjects<K extends LeadRecordType> = {
  [ObjectNames.COMPANY]: SalesforceCompany;
  [ObjectNames.LEAD]: SalesforceLead<K>;
  [ObjectNames.PROCESS]: SalesforceProcess;
  [ObjectNames.OFFER]: SalesforceOffer;
  [ObjectNames.CONTACT]: SalesforceContact;
  [ObjectNames.BINOME]: SalesforceBinome;
};

export type SalesforceObject<
  T extends ObjectName,
  K extends LeadRecordType = AnyCantFix
> = SalesforceObjects<K>[T];

export const ContactsRecordTypesIds = {
  COACH: '0127Q000000Ub9wQAC',
  CANDIDATE: '0127Q000000UbNVQA0',
  COMPANY: '0127Q000000UomWQAS',
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

type LeadsProps = {
  [LeadsRecordTypesIds.CANDIDATE]: CandidateLeadProps;
  [LeadsRecordTypesIds.COACH]: CoachLeadProps;
  [LeadsRecordTypesIds.ASSOCIATION]: WorkerLeadProps;
  [LeadsRecordTypesIds.COMPANY]: CompanyLeadProps;
};

export type LeadProp<T extends LeadRecordType> = LeadsProps[T];

type SalesforceLeads = {
  [LeadsRecordTypesIds.CANDIDATE]: CandidateSalesforceLead;
  [LeadsRecordTypesIds.COACH]: CoachSalesforceLead;
  [LeadsRecordTypesIds.ASSOCIATION]: WorkerSalesforceLead;
  [LeadsRecordTypesIds.COMPANY]: CompanySalesforceLead;
};

export type SalesforceLead<T extends LeadRecordType> = SalesforceLeads[T];

export const LeadApproaches: { [K in CompanyApproach]: string } = {
  [CompanyApproaches.DONATION]: 'Soutenir le projet (mécénat)',
  [CompanyApproaches.INFORMATION]: "Avoir plus d'informations sur LinkedOut",
  [CompanyApproaches.MOBILIZATION]: 'Mobiliser des collaborateurs',
  [CompanyApproaches.RECRUITMENT]: 'Recruter inclusif',
} as const;

export const LeadHeardAbout: { [K in HeardAboutValue]: string } = {
  [HeardAbout.COMPANY]: 'Mon entreprise',
  [HeardAbout.ENTOURAGE]: 'Le réseau Entourage',
  [HeardAbout.PRESS]: 'Les médias (presse, web, TV)',
  [HeardAbout.LINKEDIN]: 'LinkedIn',
  [HeardAbout.SOCIAL]: 'Autres réseaux (facebook, twitter, instagram...)',
  [HeardAbout.SPORTS]: 'Un partenariat sportif',
  [HeardAbout.VOLUNTEER]: 'Un site de bénévolat',
  [HeardAbout.CONTACT]: 'Le bouche à oreille',
  [HeardAbout.OTHER]: 'Autre',
} as const;

export const LeadNationalities: { [K in CandidateNationality]: string } = {
  [CandidateNationalities.FR]: 'Française',
  [CandidateNationalities.EU]: 'Union Européenne',
  [CandidateNationalities.NOT_EU]: 'Hors Union Européenne',
  [CandidateNationalities.STATELESS]: 'Apatride',
} as const;

export const LeadAdministrativeSituations: {
  [K in CandidateAdministrativeSituation]: string;
} = {
  [CandidateAdministrativeSituations.ID_CARD_FR]:
    "Carte nationale d'identité Française",
  [CandidateAdministrativeSituations.PASSPORT]: 'Passeport',
  [CandidateAdministrativeSituations.ASYLUM]: "Demande d'asile",
  [CandidateAdministrativeSituations.ASYLUM_DISMISSED]:
    "Débouté de droit d'asile",
  [CandidateAdministrativeSituations.RESIDENT_CARD]: 'Carte de résident',
  [CandidateAdministrativeSituations.RESIDENCE_PERMIT]: 'Titre de séjour',
  [CandidateAdministrativeSituations.RESIDENCE_PERMIT_RECEIPT]:
    'Récépissé de titre de séjour',
} as const;

export const LeadAccomodations: {
  [K in CandidateAccommodation]: string;
} = {
  [CandidateAccommodations.PERSONAL]: 'Logement personnel',
  [CandidateAccommodations.SOMEONE]:
    'Hébergé chez un tiers (famille, amis, etc, ...)',
  [CandidateAccommodations.URGENCY]: "Hébergement d'urgence (CHU, hôtel...)",
  [CandidateAccommodations.INSERTION]:
    "Hébergement d'insertion (CHRS, FJT, Solibail, Résidence Sociale, Pension, ...)",
  [CandidateAccommodations.STREET]:
    'Rue ou abri de fortune (squat, voiture, camping...)',
  [CandidateAccommodations.OTHER]: 'Autre',
} as const;

export const LeadYesNo: {
  [K in CandidateYesNoValue]: string;
} = {
  [CandidateYesNo.YES]: 'Oui',
  [CandidateYesNo.NO]: 'Non',
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
  Departement__c: Department | 'Inconnu';
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
  businessLines?: BusinessLine[];
  address: string;
  department: Department;
  mainCompanySfId?: string;
}

export interface SalesforceCompany {
  Id?: string;
  Name: string;
  M_tiers_LinkedOut__c: string;
  BillingStreet: string;
  BillingCity: string;
  BillingPostalCode: string;
  Reseaux__c: 'LinkedOut';
  Antenne__c: string;
  ParentId: string;
}

export interface ContactProps {
  firstName?: string;
  lastName?: string;
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
  Casquettes_r_les__c: 'Contact Entreprise/Financeur';
  Reseaux__c: 'LinkedOut';
  RecordTypeId: ContactRecordType;
  Antenne__c?: string;
  Source__c: 'Lead entrant';
}

export interface CompanyLeadProps {
  firstName: string;
  lastName: string;
  company: string;
  position: string;
  email: string;
  phone?: string;
  approach: CompanyApproach;
  zone: CompanyZone;
  heardAbout?: HeardAboutValue;
}

export interface CompanySalesforceLead {
  Id?: string;
  LastName: string;
  FirstName: string;
  Company: string;
  Title: string;
  Email: string;
  Phone?: string;
  Reseaux__c: 'LinkedOut';
  RecordTypeId: LeadRecordType;
  Antenne__c: string;
  Votre_demarche__c: string;
  Comment_vous_nous_avez_connu__c: string;
  Source__c: 'Lead entrant';
}

export interface CandidateLeadProps {
  firstName: string;
  lastName: string;
  email: string;
  phone: string;
  postalCode: string;
  birthDate: string;
  nationality: CandidateNationality;
  administrativeSituation: CandidateAdministrativeSituation;
  workingRight: CandidateYesNoValue;
  accommodation: CandidateAccommodation;
  domiciliation: CandidateYesNoValue;
  socialSecurity: CandidateYesNoValue;
  bankAccount: CandidateYesNoValue;
  diagnostic: string;
  comment: string;
  zone: CompanyZone;
  workerSfId: string;
  associationSfId: string;
}

export interface CoachLeadProps {
  firstName: string;
  lastName: string;
  email: string;
  phone: string;
  company: string;
  position: string;
  zone: CompanyZone;
}

export interface WorkerLeadProps {
  firstName: string;
  lastName: string;
  email: string;
  phone: string;
  company: string;
  address: string;
  zone: CompanyZone;
}

export interface CandidateAndWorkerLeadProps {
  firstName: string;
  lastName: string;
  email: string;
  phone: string;
  postalCode: string;
  birthDate: string;
  nationality: CandidateNationality;
  administrativeSituation: CandidateAdministrativeSituation;
  workingRight: CandidateYesNoValue;
  accommodation: CandidateAccommodation;
  domiciliation: CandidateYesNoValue;
  socialSecurity: CandidateYesNoValue;
  bankAccount: CandidateYesNoValue;
  diagnostic: string;
  comment: string;
  workerFirstName: string;
  workerLastName: string;
  workerEmail: string;
  workerPhone: string;
  structure: string;
  structureAddress: string;
}

export interface CandidateSalesforceLead {
  Id?: string;
  LastName: string;
  FirstName: string;
  Title: string;
  Email: string;
  Phone?: string;
  BillingPostalCode: string;
  Date_de_naissance__c: string;
  Nationalite__c: string;
  Situation_administrative__c: string;
  Droit_de_travailler_en_France__c: string;
  Situation_hebergement__c: string;
  Domiciliation__c: string;
  Securite_Sociale__c: string;
  Compte_bancaire__c: string;
  Diagnostic_social_par_le_prescripteur__c: string;
  Commentaires__c: string;
  Association_prescriptrice__c: string;
  Company: 'Candidats LinkedOut';
  Reseaux__c: 'LinkedOut';
  RecordTypeId: LeadRecordType;
  Antenne__c: string;
  Source__c: 'Lead entrant';
}

export interface CoachSalesforceLead {
  Id?: string;
  LastName: string;
  FirstName: string;
  Company: string;
  Title: string;
  Email: string;
  Phone?: string;
  Reseaux__c: 'LinkedOut';
  RecordTypeId: LeadRecordType;
  Antenne__c: string;
  Source__c: 'Lead entrant';
}

export interface WorkerSalesforceLead {
  Id?: string;
  LastName: string;
  FirstName: string;
  Email: string;
  Phone?: string;
  Company: string
  Reseaux__c: 'LinkedOut';
  RecordTypeId: LeadRecordType;
  Antenne__c: string;
  Source__c: 'Lead entrant';
}
