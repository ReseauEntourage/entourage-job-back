import { AnyToFix } from './utils';

export type Filters<T> = Filter<T>[];

export interface Filter<K> {
  key: K;
  constants: FilterConstant<AnyToFix>[];
  title: string;
}

export interface FilterConstant<T> {
  value: T;
  label: string;
}

export type FilterObject<K extends string> = Partial<
  Record<K, FilterConstant<AnyToFix>[]>
>;

export type FilterParams<K extends string> = Partial<Record<K, string[]>>;
