import { AnyToFix } from './utils';

export type Filters<K, T extends AnyToFix = AnyToFix> = Filter<K, T>[];

export interface Filter<K, T extends AnyToFix = AnyToFix> {
  key: K;
  constants: FilterConstant<T>[];
  title: string;
}

export interface FilterConstant<T> {
  value: T;
  label: string;
}

export type FilterObject<
  K extends string,
  T extends AnyToFix = AnyToFix
> = Partial<Record<K, FilterConstant<T>[]>>;

export type FilterParams<K extends string> = Partial<Record<K, string[]>>;
