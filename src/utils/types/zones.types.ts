import _ from 'lodash';
import { FilterConstant } from './filters.types';
import { SfLocalBranchName } from './local-branches.types';

export enum ZoneName {
  // TO CONVERT TO IDF IN DATABASE AND METABASE IN FUTURE
  AURA = 'LYON',
  // TO _MOVE_ INTO BRETAGNE IN DATABASE AND METABASE IN FUTURE
  BRETAGNE = 'RENNES',
  HZ = 'HORS ZONE',
  IDF = 'PARIS',
  // TO CONVERT TO NORD IN DATABASE AND METABASE IN FUTURE
  LORIENT = 'LORIENT',
  // TO CONVERT TO AURA IN DATABASE AND METABASE IN FUTURE
  NORD = 'LILLE',
  // TO CONVERT INTO BRETAGNE IN DATABASE AND METABASE IN FUTURE
  SUDOUEST = 'SUDOUEST',
}

export enum ZoneSuffix {
  HZ = 'HZ',
  LILLE = 'LILLE',
  LORIENT = 'LORIENT',
  LYON = 'LYON',
  PARIS = 'PARIS',
  RENNES = 'RENNES',
  SUDOUEST = 'SUDOUEST',
}

export enum StaffContactGroup {
  CANDIDATE = 'candidate',
  COMPANY = 'company',
  MAIN = 'main',
}

export type InternalStaffContact = {
  email: string;
  entourageProEmail: string;
  img: string;
  name: string;
  slackEmail: string;
};

export type PublicStaffContact = Omit<
  InternalStaffContact,
  'slackEmail' | 'entourageProEmail'
>;

export type Zone = {
  name: ZoneName;
  sfLocalBranchNames: SfLocalBranchName[];
  staffContact: {
    [key in StaffContactGroup]: InternalStaffContact;
  };
  suffix: ZoneSuffix;
};

export const ZoneNameFilters: FilterConstant<ZoneName>[] = [
  { value: ZoneName.IDF, label: _.capitalize(ZoneName.IDF) },
  { value: ZoneName.NORD, label: _.capitalize(ZoneName.NORD) },
  { value: ZoneName.AURA, label: _.capitalize(ZoneName.AURA) },
  { value: ZoneName.LORIENT, label: _.capitalize(ZoneName.LORIENT) },
  { value: ZoneName.BRETAGNE, label: _.capitalize(ZoneName.BRETAGNE) },
  { value: ZoneName.SUDOUEST, label: _.capitalize(ZoneName.SUDOUEST) },
  { value: ZoneName.HZ, label: _.capitalize(ZoneName.HZ) },
];

export type ZoneNameFilter = (typeof ZoneNameFilters)[number];
