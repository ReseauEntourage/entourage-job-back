import {
  BusinessSectorFilters,
  BusinessSectorValue,
} from 'src/common/business-sectors/business-sectors.types';
import { BusinessSector } from 'src/common/business-sectors/models';
import { Department } from 'src/common/locations/locations.types';
import {
  CandidateAccommodation,
  CandidateAccommodations,
  CandidateAdministrativeSituation,
  CandidateAdministrativeSituations,
  CandidateGender,
  CandidateGenders,
  CandidateHelpWith,
  CandidateHelpWithValue,
  CandidateProfessionalSituation,
  CandidateProfessionalSituations,
  CandidateResource,
  CandidateResources,
  CandidateYesNo,
  CandidateYesNoNSPP,
  CandidateYesNoNSPPValue,
  CandidateYesNoValue,
  CompanyApproach,
  CompanyApproaches,
  CompanyZone,
  HeardAbout,
  HeardAboutValue,
  JobSearchDuration,
  JobSearchDurations,
  Nationalities,
  Nationality,
  StudiesLevel,
  StudiesLevels,
  WorkingExperience,
  WorkingExperienceYears,
  YesNoJNSPR,
  YesNoJNSPRValue,
} from 'src/contacts/contacts.types';

import { RegistrableUserRole } from 'src/users/users.types';
import { findConstantFromValue } from 'src/utils/misc/findConstantFromValue';
import { AnyCantFix } from 'src/utils/types';

export const ErrorCodes = {
  DUPLICATES_DETECTED: 'DUPLICATES_DETECTED',
  DUPLICATE_VALUE: 'DUPLICATE_VALUE',
  CANNOT_UPDATE_CONVERTED_LEAD: 'CANNOT_UPDATE_CONVERTED_LEAD',
  FIELD_INTEGRITY_EXCEPTION: 'FIELD_INTEGRITY_EXCEPTION',
  FIELD_FILTER_VALIDATION_EXCEPTION: 'FIELD_FILTER_VALIDATION_EXCEPTION',
  NOT_FOUND: 'NOT_FOUND',
  UNABLE_TO_LOCK_ROW: 'UNABLE_TO_LOCK_ROW',
  FIELD_CUSTOM_VALIDATION_EXCEPTION: 'FIELD_CUSTOM_VALIDATION_EXCEPTION:',
} as const;

export type ErrorCode = (typeof ErrorCodes)[keyof typeof ErrorCodes];

export interface SalesforceError {
  duplicateResult: {
    matchResults: {
      matchRecords: {
        record: {
          Id: string;
        };
      }[];
    }[];
  };
  errorCode: ErrorCode;
  message: string;
}

export const ObjectNames = {
  ACCOUNT: 'Account',
  LEAD: 'Lead',
  CONTACT: 'Contact',
  BINOME: 'Binome__c',
  CAMPAIGN: 'Campaign',
  CAMPAIGN_MEMBER: 'CampaignMember',
  TASK: 'Task',
  USER: 'User',
} as const;

export type ObjectName = (typeof ObjectNames)[keyof typeof ObjectNames];

type SalesforceObjects<K extends LeadRecordType> = {
  [ObjectNames.ACCOUNT]: SalesforceAccount;
  [ObjectNames.LEAD]: SalesforceLead<K>;
  [ObjectNames.CONTACT]: SalesforceContact;
  [ObjectNames.BINOME]: SalesforceBinome;
  [ObjectNames.CAMPAIGN]: SalesforceCampaign;
  [ObjectNames.CAMPAIGN_MEMBER]: SalesforceCampaignMember;
  [ObjectNames.TASK]: SalesforceTask;
  [ObjectNames.USER]: SalesforceUser;
};

export type SalesforceObject<
  T extends ObjectName,
  K extends LeadRecordType = AnyCantFix
> = SalesforceObjects<K>[T];

export const ContactRecordTypesIds = {
  COMPANY: '0127Q000000UomWQAS',
  ASSOCIATION: '0127Q000000Uhq0QAC',
  PRECARIOUS: '012Jv000000wYfdIAE',
  NEIGHBOR: '012Jv000000wYfeIAE',
} as const;

export const LeadYesNoJNSPR: { [K in YesNoJNSPRValue]: string } = {
  [YesNoJNSPR.YES]: 'Oui',
  [YesNoJNSPR.NO]: 'Non',
  [YesNoJNSPR.JNSPR]: '',
} as const;

export type ContactRecordType =
  (typeof ContactRecordTypesIds)[keyof typeof ContactRecordTypesIds];

export const LeadRecordTypesIds = {
  COACH: '0127Q000000UbQPQA0',
  CANDIDATE: '0127Q000000UbQKQA0',
  COMPANY: '0127Q000000ThTsQAK',
  ASSOCIATION: '0127Q000000Thz9QAC',
} as const;

export type LeadRecordType =
  (typeof LeadRecordTypesIds)[keyof typeof LeadRecordTypesIds];

export const AccountRecordTypesIds = {
  COMPANY: '0127Q000000TZ4YQAW',
  ASSOCIATION: '0127Q000000TZ4sQAG',
  HOUSEHOLD: '012Jv000001XP78IAG',
} as const;

export type AccountRecordType =
  (typeof AccountRecordTypesIds)[keyof typeof AccountRecordTypesIds];

export const EventRecordTypesIds = {
  BINOME: '0127Q000000UhqeQAC',
} as const;

export type EventRecordType =
  (typeof EventRecordTypesIds)[keyof typeof EventRecordTypesIds];

type LeadsProps = {
  [LeadRecordTypesIds.CANDIDATE]: CandidateLeadProps;
  [LeadRecordTypesIds.COACH]: CoachLeadProps;
  [LeadRecordTypesIds.ASSOCIATION]: WorkerLeadProps;
  [LeadRecordTypesIds.COMPANY]: CompanyLeadProps;
};

export type LeadProp<T extends LeadRecordType> = LeadsProps[T];

export type SalesforceLeads = {
  [LeadRecordTypesIds.CANDIDATE]: CandidateSalesforceLead;
  [LeadRecordTypesIds.COACH]: CoachSalesforceLead;
  [LeadRecordTypesIds.ASSOCIATION]: WorkerSalesforceLead;
  [LeadRecordTypesIds.COMPANY]: CompanySalesforceLead;
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
  [HeardAbout.ORIENTATION]: 'Association / travailleur social',
  [HeardAbout.CONTACT]: 'Le bouche à oreille',
  [HeardAbout.POLE_EMPLOI]: 'Pôle Emploi',
  [HeardAbout.OTHER]: 'Autre',
} as const;

export const LeadHelpWith: { [K in CandidateHelpWithValue]: string } = {
  [CandidateHelpWith.WORK]: 'Emploi',
  [CandidateHelpWith.SOCIAL]: 'Social',
  [CandidateHelpWith.ACCOMMODATION]: 'Logement',
  [CandidateHelpWith.HEALTH]: 'Santé',
  [CandidateHelpWith.RIGHTS]: 'Accès aux droits',
  [CandidateHelpWith.OTHER]: 'Autre',
} as const;
export const LeadResources: { [K in CandidateResource]: string } = {
  [CandidateResources.SALARY]: 'Salaire',
  [CandidateResources.UNEMPLOYMENT]: 'Allocation chômage',
  [CandidateResources.INVALIDITY]: "Pension d'invalidité",
  [CandidateResources.RSA]: 'RSA',
  [CandidateResources.AAH]: 'AAH',
  [CandidateResources.OTHER]: 'Autre',
  [CandidateResources.NONE]: 'Aucune',
  [CandidateResources.JNSPR]: '',
} as const;

export const LeadNationalities: { [K in Nationality]: string } = {
  [Nationalities.FRENCH]: 'Française',
  [Nationalities.EUROPEAN]: 'Union Européenne	',
  [Nationalities.EXTRA_EUROPEAN]: 'Hors Union Européenne',
  [Nationalities.STATELESS]: 'Apatride',
  [Nationalities.JNSPR]: '',
} as const;

export const LeadJobSearchDurations: {
  [K in JobSearchDuration]: string;
} = {
  [JobSearchDurations.LESS_THAN_3_MONTHS]: '0-3 mois',
  [JobSearchDurations.BETWEEN_3_AND_6_MONTHS]: '3-6 mois',
  [JobSearchDurations.BETWEEN_6_AND_12_MONTHS]: '6-12 mois',
  [JobSearchDurations.BETWEEN_12_AND_24_MONTHS]: '12-24 mois',
  [JobSearchDurations.BETWEEN_24_AND_36_MONTHS]: '24-36 mois',
  [JobSearchDurations.MORE_THAN_36_MONTHS]: 'Plus de 36 mois',
  [JobSearchDurations.JNSPR]: '',
} as const;

export const LeadStudiesLevels: { [K in StudiesLevel]: string } = {
  [StudiesLevels.NONE]: 'Aucun',
  [StudiesLevels.CAP_BEP]: '3 CAP/BEP',
  [StudiesLevels.BAC]: '4 Baccalauréat',
  [StudiesLevels.BAC_PLUS_2]: '5 Bac +2',
  [StudiesLevels.BAC_PLUS_3]: '6 Bac +3 - licence',
  [StudiesLevels.BAC_PLUS_5]: '7 Bac + 4/5 - master',
  [StudiesLevels.BAC_PLUS_8]: '8 Doctorat',
  [StudiesLevels.JNSPR]: '',
} as const;

export const LeadWorkingExperienceYears: { [K in WorkingExperience]: string } =
  {
    [WorkingExperienceYears.LESS_THAN_3_YEAR]: '	Moins de 3 ans',
    [WorkingExperienceYears.BETWEEN_3_AND_10_YEARS]: 'Entre 3 et 10 ans',
    [WorkingExperienceYears.MORE_THAN_10_YEARS]: 'Plus de 10 ans',
    [WorkingExperienceYears.JNSPR]: '',
  } as const;

export const LeadProfessionalSituation: {
  [K in CandidateProfessionalSituation]: string;
} = {
  [CandidateProfessionalSituations.UNEMPLOYED]: 'Sans emploi',
  [CandidateProfessionalSituations.CDI]: 'CDI',
  [CandidateProfessionalSituations.CDD]: 'CDD',
  [CandidateProfessionalSituations.CDDI]: "Contrat d'insertion",
  [CandidateProfessionalSituations.INTE]: 'Intérim',
  [CandidateProfessionalSituations.FORM]: 'En formation',
  [CandidateProfessionalSituations.OTHER]: 'Autre',
  [CandidateProfessionalSituations.STUDENT]: 'Etudiant',
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
  [CandidateAccommodations.JNSPR]: '',
} as const;

export const LeadGender: {
  [K in CandidateGender]: string | null;
} = {
  [CandidateGenders.MALE]: 'Homme',
  [CandidateGenders.FEMALE]: 'Femme',
  [CandidateGenders.OTHER]: '',
} as const;

export const LeadYesNo: {
  [K in CandidateYesNoValue]: string;
} = {
  [CandidateYesNo.YES]: 'Oui',
  [CandidateYesNo.NO]: 'Non',
} as const;

export const LeadYesNoNSPP: {
  [K in CandidateYesNoNSPPValue]: string;
} = {
  [CandidateYesNoNSPP.YES]: 'Oui',
  [CandidateYesNoNSPP.NO]: 'Non',
  [CandidateYesNoNSPP.NSPP]: 'Je ne sais pas',
} as const;

export const LeadBusinessSectors: {
  [K in BusinessSectorValue]: string;
} = {
  la: findConstantFromValue('la', BusinessSectorFilters).label,
  aa: findConstantFromValue('aa', BusinessSectorFilters).label,
  bat: findConstantFromValue('bat', BusinessSectorFilters).label,
  rh: findConstantFromValue('rh', BusinessSectorFilters).label,
  cd: findConstantFromValue('cd', BusinessSectorFilters).label,
  asp: findConstantFromValue('asp', BusinessSectorFilters).label,
  pr: findConstantFromValue('pr', BusinessSectorFilters).label,
  mi: findConstantFromValue('mi', BusinessSectorFilters).label,
  art: findConstantFromValue('art', BusinessSectorFilters).label,
  tra: findConstantFromValue('tra', BusinessSectorFilters).label,
  id: findConstantFromValue('id', BusinessSectorFilters).label,
  sec: findConstantFromValue('sec', BusinessSectorFilters).label,
  cm: findConstantFromValue('cm', BusinessSectorFilters).label,
  ca: findConstantFromValue('ca', BusinessSectorFilters).label,
  aev: findConstantFromValue('aev', BusinessSectorFilters).label,
  sa: findConstantFromValue('sa', BusinessSectorFilters).label,
  fjr: findConstantFromValue('fjr', BusinessSectorFilters).label,
  sm: findConstantFromValue('sm', BusinessSectorFilters).label,
} as const;

export enum Casquette {
  CANDIDAT_COUP_DE_POUCE = 'PRO Candidat Coup de pouce',
  COACH_COUP_DE_POUCE = 'PRO Coach Coup de pouce',
  CONTACT_ENTREPRISE_FINANCEUR = 'Contact Entreprise/Financeur',
  PRESCRIPTEUR = 'PRO Prescripteur',
}

export interface SalesforceBinome {
  Id?: string;
}

export interface SalesforceTask {
  ActivityDate: Date;
  Antenne__c: string;
  Bin_me__c: string;
  ID_Externe__c: string;
  Id?: string;
  OwnerId: string;
  Status: 'Completed' | 'Open';
  Subject: string;
  WhoId: string;
}

export interface AccountProps {
  address?: string;
  businessSectors?: BusinessSector[];
  department?: Department;
  mainAccountSfId?: string;
  name: string;
  organizationType?: 'Entreprise';
  phone?: string;
}

export interface SalesforceAccount {
  Antenne__c: string;
  BillingCity: string;
  BillingPostalCode: string;
  BillingStreet: string;
  Id?: string;
  M_tiers_LinkedOut__c: string;
  Name: string;
  ParentId: string;
  Phone?: string;
  RecordTypeId: AccountRecordType;
  Reseaux__c: 'LinkedOut';
  Type_org__c?: 'Entreprise';
}

export interface SalesforceCampaign {
  Adresse_de_l_v_nement__c?: string;
  Antenne__c?: string;
  CampaignMembers?: {
    records: Partial<SalesforceCampaignMember>[];
  };
  Code_postal__c?: string;
  Description?: string;
  En_ligne__c?: string;
  EndDate?: string;
  Heure_de_d_but__c?: string;
  Heure_de_fin__c?: string;
  Id?: string;
  MeetingLink__c?: string;
  Name?: string;
  Nombre_d_inscrits__c?: number;
  Nombre_de_participants__c?: number;
  Public_sensibilis__c?: string;
  StartDate?: string;
  Type_evenement__c?: string;
}

export enum SalesforceCampaignStatus {
  REGISTERED = 'Inscrit',
  RESPONDED = 'Répondu',
}

export interface SalesforceCampaignMember {
  CampaignId: string;
  ContactId?: string;
  // Inscrit
  Email?: string;
  Id?: string;
  // never used, only for TS purpose
  LeadId?: string;
  Status: string;
}

export interface SalesforceUser {
  Email: string;
  Id?: string;
}

export interface ContactProps {
  accommodation?: CandidateAccommodation;
  accountSfId?: string;
  birthDate?: Date;
  casquettes?: Casquette[];
  department?: Department;
  email?: string;
  firstName?: string;
  gender?: CandidateGender;
  hasSocialWorker?: YesNoJNSPRValue;
  id?: string;
  jobSearchDuration?: JobSearchDuration;
  lastName?: string;
  nationality?: Nationality;
  phone?: string;
  position?: string;
  refererId?: string;
  resources?: CandidateResource;
  studiesLevel?: StudiesLevel;
  workingExperience?: WorkingExperience;
}

export interface SalesforceContact {
  Accompagnement_social_O_N__c: string;
  AccountId: string;
  Ann_es_d_exp_rience_professionnelle__c: string;
  Antenne__c?: string;
  Casquettes_r_les__c: string;
  Date_de_naissance__c?: Date;
  Dur_e_de_recherche_d_emploi__c: string;
  Email: string;
  FirstName: string;
  Fonction?: string;
  Genre__c: string;
  ID_App_Entourage_Pro__c?: string;
  Id?: string;
  LastName: string;
  MailingPostalCode?: string;
  Nationalit__c: string;
  Phone: string;
  Plus_haut_niveau_de_formation_attein__c: string;
  RecordTypeId: ContactRecordType;
  Reseaux__c: 'LinkedOut';
  Situation_d_h_bergement__c: string;
  Source__c: 'Lead entrant';
  TS_prescripteur__c?: string;
  Title: string;
  Type_de_ressources__c?: string;
}

export interface CompanyLeadProps {
  approach?: CompanyApproach;
  autreSource?: 'Formulaire_Contact_Candidat';
  company: string;
  email: string;
  firstName: string;
  heardAbout?: HeardAboutValue;
  lastName: string;
  message?: string;
  newsletter?: 'Newsletter LinkedOut';
  phone?: string;
  position?: string;
  zone: CompanyZone;
}

export interface CompanySalesforceLead {
  Abonnements_Plezi__c?: 'Newsletter LinkedOut';
  Antenne__c: string;
  Autre_source_LinkedOut__c?: 'Formulaire_Contact_Candidat';
  Comment_vous_nous_avez_connu__c: string;
  Company: string;
  Email: string;
  FirstName: string;
  Id?: string;
  LastName: string;
  Message_For__c?: string;
  OwnerId?: string;
  Phone?: string;
  RecordTypeId: LeadRecordType;
  Reseaux__c: 'LinkedOut';
  Source__c: 'Lead entrant';
  Title: string;
  Votre_demarche__c: string;
}

export interface CandidateLeadProps {
  accommodation?: CandidateAccommodation;
  address?: string;
  administrativeSituation?: CandidateAdministrativeSituation;
  associationSfId?: string;
  autreSource?: 'Formulaire_Sourcing_Page_Travailler';
  bankAccount?: CandidateYesNoValue;
  birthDate?: Date;
  businessSectors?: BusinessSectorValue[];
  city?: string;
  description?: string;
  diagnostic?: string;
  domiciliation?: CandidateYesNoValue;
  email?: string;
  firstName: string;
  gender?: CandidateGender;
  handicapped?: CandidateYesNoValue;
  hasSocialWorker?: YesNoJNSPRValue;
  heardAbout?: HeardAboutValue;
  helpWith?: CandidateHelpWithValue[];
  jobSearchDuration?: JobSearchDuration;
  lastName: string;
  location?: string;
  nationality?: Nationality;
  phone: string;
  postalCode?: string;
  professionalSituation?: CandidateProfessionalSituation;
  registeredUnemploymentOffice?: CandidateYesNoValue;
  resources?: CandidateResource;
  socialSecurity?: CandidateYesNoValue;
  studiesLevel?: StudiesLevel;
  tsPrescripteur?: string;
  workerSfIdAsContact?: string;
  workerSfIdAsProspect?: string;
  workingExperience?: WorkingExperience;
  workingRight?: CandidateYesNoNSPPValue;
  zone: CompanyZone;
}

export interface CoachLeadProps {
  company: string;
  email: string;
  firstName: string;
  lastName: string;
  phone: string;
  position: string;
  zone: CompanyZone;
}

export interface WorkerLeadProps {
  company: string;
  contactWithCoach: boolean;
  email: string;
  firstName: string;
  heardAbout: HeardAboutValue;
  lastName: string;
  phone: string;
  position?: string;
  zone: CompanyZone;
}

export interface CandidateInscriptionLeadProps {
  birthdate: Date;
  department: Department;
  email: string;
  firstName: string;
  heardAbout?: HeardAboutValue;
  infoCo: string;
  lastName: string;
  phone: string;
  tsPrescripteur?: string;
  workingRight: CandidateYesNoNSPPValue;
}

export interface CandidateAndWorkerLeadProps {
  accommodation: CandidateAccommodation;
  address?: string;
  administrativeSituation?: CandidateAdministrativeSituation;
  bankAccount: CandidateYesNoValue;
  birthDate?: Date;
  businessSectors?: BusinessSectorValue[];
  city?: string;
  contactWithCoach?: boolean;
  description: string;
  diagnostic?: string;
  domiciliation: CandidateYesNoValue;
  email: string;
  firstName: string;
  gender: CandidateGender;
  handicapped?: CandidateYesNoValue;
  heardAbout: HeardAboutValue;
  helpWith: CandidateHelpWithValue[];
  lastName: string;
  phone: string;
  postalCode: string;
  professionalSituation: CandidateProfessionalSituation;
  registeredUnemploymentOffice: CandidateYesNoValue;
  resources?: CandidateResource;
  socialSecurity: CandidateYesNoValue;
  structure: string;
  tsPrescripteur?: string;
  workerEmail: string;
  workerFirstName: string;
  workerLastName: string;
  workerPhone: string;
  workerPosition?: string;
  workingRight: CandidateYesNoNSPPValue;
}

export interface CandidateSalesforceLead {
  Accompagnement_social_O_N__c: string;
  Accompagnement_social__c: string;
  Antenne__c: string;
  Association_prescriptrice__c: string;
  Autre_source_LinkedOut__c: 'Formulaire_Sourcing_Page_Travailler';
  City?: string;
  Comment_vous_nous_avez_connu__c: string;
  Company: 'Candidats Entourage Pro';
  Compte_bancaire__c: string;
  Date_de_naissance__c?: Date;
  Diagnostic_social_par_le_prescripteur__c?: string;
  Domiciliation__c: string;
  Droit_de_travailler_en_France__c: string;
  Duree_de_recherche_d_emploi__c: string;
  Email?: string;
  Familles_de_m_tiers__c?: string;
  FirstName: string;
  Genre__c: CandidateGender | null;
  Id?: string;
  Inscrit_au_Pole_Emploi__c: string;
  LastName: string;
  Message_For__c: string;
  Nationalite__c: string;
  OwnerId?: string;
  Phone: string;
  Plus_haut_niveau_de_formation_atteint__c: string;
  PostalCode?: string;
  Prospect__c: string;
  RQTH__c?: string;
  RecordTypeId: LeadRecordType;
  Reseaux__c: 'LinkedOut';
  Securite_Sociale__c: string;
  Situation_Professionnelle__c: string;
  Situation_administrative__c?: string;
  Situation_hebergement__c: string;
  Source__c: 'Lead entrant';
  Street?: string;
  TS_Prescripteur_Contact__c: string;
  TS_du_Candidat__c: string;
  Type_de_ressources__c?: string;
  annees_d_experiences_professionnelles__c: string;
}

export interface WorkerSalesforceLead {
  Accompagnement_social_O_N__c?: string;
  Ann_es_d_exp_rience_professionnelle__c?: string;
  Antenne__c: string;
  Comment_vous_nous_avez_connu__c: string;
  Company: string;
  Dur_e_de_recherche_d_emploi__c?: string;
  Email: string;
  FirstName: string;
  Id?: string;
  LastName: string;
  Nationalit__c?: string;
  OwnerId?: string;
  Phone: string;
  Plus_haut_niveau_de_formation_attein__c?: string;
  RecordTypeId: LeadRecordType;
  Reseaux__c: 'LinkedOut';
  Situation_d_h_bergement__c?: string;
  Source__c: 'Lead entrant';
  TS_Mettre_en_relation_Coach__c: boolean;
  Title?: string;
  Type_de_ressources__c?: string;
}

export interface CoachSalesforceLead {
  Antenne__c: string;
  Company: 'Coachs Entourage Pro' | string;
  Email: string;
  FirstName: string;
  Genre__c: CandidateGender | null;
  Id?: string;
  LastName: string;
  OwnerId?: string;
  Phone?: string;
  RecordTypeId: LeadRecordType;
  Reseaux__c: 'LinkedOut';
  Source__c: 'Lead entrant';
  Title: string;
}

export interface UserProps {
  accommodation?: CandidateAccommodation;
  birthDate: Date;
  campaign?: string;
  department: Department;
  email: string;
  firstName: string;
  gender?: CandidateGender;
  hasSocialWorker?: YesNoJNSPRValue;
  id: string;
  isCompanyAdmin?: boolean;
  jobSearchDuration?: JobSearchDuration;
  lastName: string;
  nationality?: Nationality;
  phone: string;
  position?: string;
  refererEmail?: string;
  resources?: CandidateResource;
  role: RegistrableUserRole;
  structure?: string;
  studiesLevel?: StudiesLevel;
  workingExperience?: WorkingExperience;
  workingRight?: CandidateYesNoNSPPValue;
}
