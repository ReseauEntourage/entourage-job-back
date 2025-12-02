import _ from 'lodash';
import { DepartmentCode } from './departments.types';
import { FilterConstant } from './filters.types';
import { SfLocalBranchName } from './local-branches.types';

export enum ZoneName {
  PARIS = 'PARIS',
  LYON = 'LYON',
  LILLE = 'LILLE',
  LORIENT = 'LORIENT',
  RENNES = 'RENNES',
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
  suffix: ZoneSuffix;
  departmentCodes: DepartmentCode[];
  sfLocalBranches: SfLocalBranchName[];
  staffContact: {
    [key in StaffContactGroup]: InternalStaffContact;
  };
};

export const ZoneNameFilters: FilterConstant<ZoneName>[] = [
  { value: ZoneName.PARIS, label: _.capitalize(ZoneName.PARIS) },
  { value: ZoneName.LILLE, label: _.capitalize(ZoneName.LILLE) },
  { value: ZoneName.LYON, label: _.capitalize(ZoneName.LYON) },
  { value: ZoneName.LORIENT, label: _.capitalize(ZoneName.LORIENT) },
  { value: ZoneName.RENNES, label: _.capitalize(ZoneName.RENNES) },
  { value: ZoneName.SUDOUEST, label: _.capitalize(ZoneName.SUDOUEST) },
  { value: ZoneName.HZ, label: _.capitalize(ZoneName.HZ) },
];

export type ZoneNameFilter = (typeof ZoneNameFilters)[number];
