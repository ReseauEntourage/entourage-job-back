import { AnyCantFix } from './utils';

export type FilterConstant = { label: string; value: AnyCantFix };

export type Filter = {
  key: string;
  title: string;
  constants: Array<FilterConstant>;
};

export type FilterParams = Record<string, Array<FilterConstant>>;
