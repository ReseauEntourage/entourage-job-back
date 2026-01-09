import _ from 'lodash';
import { FilterConstant } from './filters.types';
import { SfLocalBranchName } from './local-branches.types';

export enum ZoneName {
  IDF = 'PARIS', // TO CONVERT TO IDF IN DATABASE AND METABASE IN FUTURE
  AURA = 'LYON', // TO CONVERT TO AURA IN DATABASE AND METABASE IN FUTURE
  NORD = 'LILLE', // TO CONVERT TO NORD IN DATABASE AND METABASE IN FUTURE
  LORIENT = 'LORIENT', // TO _MOVE_ INTO BRETAGNE IN DATABASE AND METABASE IN FUTURE
  BRETAGNE = 'RENNES', // TO CONVERT INTO BRETAGNE IN DATABASE AND METABASE IN FUTURE
  SUDOUEST = 'SUDOUEST',
  HZ = 'HORS ZONE',
}

export enum ZoneSuffix {
  PARIS = 'PARIS',
  LYON = 'LYON',
  LILLE = 'LILLE',
  LORIENT = 'LORIENT',
  RENNES = 'RENNES',
  SUDOUEST = 'SUDOUEST',
  HZ = 'HZ',
}

export enum StaffContactGroup {
  MAIN = 'main',
  COMPANY = 'company',
}

export type InternalStaffContact = {
  name: string;
  email: string;
  img: string;
  slackEmail: string;
};

export type PublicStaffContact = Omit<InternalStaffContact, 'slackEmail'>;

export type Zone = {
  name: ZoneName;
  sfLocalBranchNames: SfLocalBranchName[];
  suffix: ZoneSuffix;
  staffContact: {
    [key in StaffContactGroup]: InternalStaffContact;
  };
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
