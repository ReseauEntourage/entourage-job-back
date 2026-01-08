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
  errorCode: ErrorCode;
  message: string;
  duplicateResult: {
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
  CONTACT_ENTREPRISE_FINANCEUR = 'Contact Entreprise/Financeur',
  PRESCRIPTEUR = 'PRO Prescripteur',
  COACH_COUP_DE_POUCE = 'PRO Coach Coup de pouce',
  CANDIDAT_COUP_DE_POUCE = 'PRO Candidat Coup de pouce',
}

export interface SalesforceBinome {
  Id?: string;
}

export interface SalesforceTask {
  Id?: string;
  ActivityDate: Date;
  Status: 'Completed' | 'Open';
  WhoId: string;
  Bin_me__c: string;
  Subject: string;
  OwnerId: string;
  ID_Externe__c: string;
  Antenne__c: string;
}

export interface AccountProps {
  name: string;
  businessSectors?: BusinessSector[];
  address?: string;
  department?: Department;
  mainAccountSfId?: string;
  phone?: string;
  organizationType?: 'Entreprise';
}

export interface SalesforceAccount {
  Id?: string;
  Name: string;
  M_tiers_LinkedOut__c: string;
  BillingStreet: string;
  BillingCity: string;
  BillingPostalCode: string;
  RecordTypeId: AccountRecordType;
  Reseaux__c: 'LinkedOut';
  Antenne__c: string;
  Type_org__c?: 'Entreprise';
  Phone?: string;
  ParentId: string;
}

export interface SalesforceCampaign {
  Id?: string;
  Name?: string;
  Description?: string;
  Antenne__c?: string;
  StartDate?: string;
  Heure_de_d_but__c?: string;
  EndDate?: string;
  Heure_de_fin__c?: string;
  Adresse_de_l_v_nement__c?: string;
  Code_postal__c?: string;
  Type_evenement__c?: string;
  Nombre_d_inscrits__c?: number;
  Nombre_de_participants__c?: number;
  En_ligne__c?: string;
  MeetingLink__c?: string;
  CampaignMembers?: {
    records: Partial<SalesforceCampaignMember>[];
  };
}

export enum SalesforceCampaignStatus {
  REGISTERED = 'Inscrit',
  RESPONDED = 'Répondu',
}

export interface SalesforceCampaignMember {
  Id?: string; // never used, only for TS purpose
  LeadId?: string;
  ContactId?: string;
  CampaignId: string;
  Status: string; // Inscrit
  Email?: string;
}

export interface SalesforceUser {
  Id?: string;
  Email: string;
}

export interface ContactProps {
  id?: string;
  firstName?: string;
  lastName?: string;
  email?: string;
  phone?: string;
  birthDate?: Date;
  position?: string;
  department?: Department;
  accountSfId?: string;
  casquettes?: Casquette[];
  nationality?: Nationality;
  accommodation?: CandidateAccommodation;
  hasSocialWorker?: YesNoJNSPRValue;
  resources?: CandidateResource;
  studiesLevel?: StudiesLevel;
  workingExperience?: WorkingExperience;
  jobSearchDuration?: JobSearchDuration;
  gender?: CandidateGender;
  refererId?: string;
}

export interface SalesforceContact {
  Id?: string;
  LastName: string;
  FirstName: string;
  Date_de_naissance__c?: Date;
  Email: string;
  Phone: string;
  Title: string;
  AccountId: string;
  Casquettes_r_les__c: string;
  Reseaux__c: 'LinkedOut';
  RecordTypeId: ContactRecordType;
  Antenne__c?: string;
  MailingPostalCode?: string;
  ID_App_Entourage_Pro__c?: string;
  Source__c: 'Lead entrant';
  Nationalit__c: string;
  Accompagnement_social_O_N__c: string;
  Plus_haut_niveau_de_formation_attein__c: string;
  Ann_es_d_exp_rience_professionnelle__c: string;
  Dur_e_de_recherche_d_emploi__c: string;
  Situation_d_h_bergement__c: string;
  Type_de_ressources__c?: string;
  Genre__c: string;
  TS_prescripteur__c?: string;
  Fonction?: string;
}

export interface CompanyLeadProps {
  firstName: string;
  lastName: string;
  company: string;
  position?: string;
  email: string;
  phone?: string;
  approach?: CompanyApproach;
  zone: CompanyZone;
  heardAbout?: HeardAboutValue;
  autreSource?: 'Formulaire_Contact_Candidat';
  message?: string;
  newsletter?: 'Newsletter LinkedOut';
}

export interface CompanySalesforceLead {
  Id?: string;
  OwnerId?: string;
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
  Autre_source_LinkedOut__c?: 'Formulaire_Contact_Candidat';
  Message_For__c?: string;
  Abonnements_Plezi__c?: 'Newsletter LinkedOut';
}

export interface CandidateLeadProps {
  firstName: string;
  lastName: string;
  helpWith?: CandidateHelpWithValue[];
  gender?: CandidateGender;
  birthDate?: Date;
  address?: string;
  postalCode?: string;
  city?: string;
  phone: string;
  email?: string;
  registeredUnemploymentOffice?: CandidateYesNoValue;
  administrativeSituation?: CandidateAdministrativeSituation;
  workingRight?: CandidateYesNoNSPPValue;
  accommodation?: CandidateAccommodation;
  professionalSituation?: CandidateProfessionalSituation;
  resources?: CandidateResource;
  domiciliation?: CandidateYesNoValue;
  socialSecurity?: CandidateYesNoValue;
  handicapped?: CandidateYesNoValue;
  bankAccount?: CandidateYesNoValue;
  businessSectors?: BusinessSectorValue[];
  description?: string;
  diagnostic?: string;
  zone: CompanyZone;
  workerSfIdAsProspect?: string;
  workerSfIdAsContact?: string;
  associationSfId?: string;
  heardAbout?: HeardAboutValue;
  location?: string;
  autreSource?: 'Formulaire_Sourcing_Page_Travailler';
  tsPrescripteur?: string;
  nationality?: Nationality;
  hasSocialWorker?: YesNoJNSPRValue;
  studiesLevel?: StudiesLevel;
  workingExperience?: WorkingExperience;
  jobSearchDuration?: JobSearchDuration;
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
  company: string;
  position?: string;
  email: string;
  phone: string;
  heardAbout: HeardAboutValue;
  contactWithCoach: boolean;
  zone: CompanyZone;
}

export interface CandidateInscriptionLeadProps {
  birthdate: Date;
  email: string;
  firstName: string;
  heardAbout?: HeardAboutValue;
  infoCo: string;
  lastName: string;
  department: Department;
  phone: string;
  workingRight: CandidateYesNoNSPPValue;
  tsPrescripteur?: string;
}

export interface CandidateAndWorkerLeadProps {
  workerFirstName: string;
  workerLastName: string;
  structure: string;
  workerPosition?: string;
  workerEmail: string;
  workerPhone: string;
  firstName: string;
  lastName: string;
  helpWith: CandidateHelpWithValue[];
  gender: CandidateGender;
  birthDate?: Date;
  address?: string;
  postalCode: string;
  city?: string;
  phone: string;
  email: string;
  registeredUnemploymentOffice: CandidateYesNoValue;
  administrativeSituation?: CandidateAdministrativeSituation;
  workingRight: CandidateYesNoNSPPValue;
  accommodation: CandidateAccommodation;
  professionalSituation: CandidateProfessionalSituation;
  resources?: CandidateResource;
  domiciliation: CandidateYesNoValue;
  socialSecurity: CandidateYesNoValue;
  handicapped?: CandidateYesNoValue;
  bankAccount: CandidateYesNoValue;
  businessSectors?: BusinessSectorValue[];
  description: string;
  heardAbout: HeardAboutValue;
  diagnostic?: string;
  contactWithCoach?: boolean;
  tsPrescripteur?: string;
}

export interface CandidateSalesforceLead {
  Id?: string;
  OwnerId?: string;
  LastName: string;
  FirstName: string;
  Email?: string;
  Phone: string;
  Genre__c: CandidateGender | null;
  Date_de_naissance__c?: Date;
  Situation_administrative__c?: string;
  Droit_de_travailler_en_France__c: string;
  Situation_hebergement__c: string;
  Domiciliation__c: string;
  Securite_Sociale__c: string;
  Compte_bancaire__c: string;
  Diagnostic_social_par_le_prescripteur__c?: string;
  Association_prescriptrice__c: string;
  TS_Prescripteur_Contact__c: string;
  Prospect__c: string;
  PostalCode?: string;
  Street?: string;
  City?: string;
  Accompagnement_social__c: string;
  Situation_Professionnelle__c: string;
  Inscrit_au_Pole_Emploi__c: string;
  RQTH__c?: string;
  Familles_de_m_tiers__c?: string;
  Message_For__c: string;
  Type_de_ressources__c?: string;
  Company: 'Candidats Entourage Pro';
  Reseaux__c: 'LinkedOut';
  RecordTypeId: LeadRecordType;
  Antenne__c: string;
  Source__c: 'Lead entrant';
  Autre_source_LinkedOut__c: 'Formulaire_Sourcing_Page_Travailler';
  TS_du_Candidat__c: string;
  Comment_vous_nous_avez_connu__c: string;
  Nationalite__c: string;
  Accompagnement_social_O_N__c: string;
  Plus_haut_niveau_de_formation_atteint__c: string;
  annees_d_experiences_professionnelles__c: string;
  Duree_de_recherche_d_emploi__c: string;
}

export interface WorkerSalesforceLead {
  Id?: string;
  OwnerId?: string;
  LastName: string;
  FirstName: string;
  Title?: string;
  Email: string;
  Phone: string;
  Company: string;
  Comment_vous_nous_avez_connu__c: string;
  TS_Mettre_en_relation_Coach__c: boolean;
  Reseaux__c: 'LinkedOut';
  RecordTypeId: LeadRecordType;
  Antenne__c: string;
  Source__c: 'Lead entrant';
  Nationalit__c?: string;
  Accompagnement_social_O_N__c?: string;
  Plus_haut_niveau_de_formation_attein__c?: string;
  Ann_es_d_exp_rience_professionnelle__c?: string;
  Dur_e_de_recherche_d_emploi__c?: string;
  Type_de_ressources__c?: string;
  Situation_d_h_bergement__c?: string;
}

export interface CoachSalesforceLead {
  Id?: string;
  OwnerId?: string;
  LastName: string;
  FirstName: string;
  Company: 'Coachs Entourage Pro' | string;
  Title: string;
  Email: string;
  Phone?: string;
  Reseaux__c: 'LinkedOut';
  RecordTypeId: LeadRecordType;
  Antenne__c: string;
  Source__c: 'Lead entrant';
  Genre__c: CandidateGender | null;
}

export interface UserProps {
  id: string;
  firstName: string;
  lastName: string;
  email: string;
  phone: string;
  department: Department;
  role: RegistrableUserRole;
  birthDate: Date;
  workingRight?: CandidateYesNoNSPPValue;
  campaign?: string;
  nationality?: Nationality;
  accommodation?: CandidateAccommodation;
  hasSocialWorker?: YesNoJNSPRValue;
  resources?: CandidateResource;
  studiesLevel?: StudiesLevel;
  workingExperience?: WorkingExperience;
  jobSearchDuration?: JobSearchDuration;
  gender?: CandidateGender;
  structure?: string;
  refererEmail?: string;
  isCompanyAdmin?: boolean;
  position?: string;
}
