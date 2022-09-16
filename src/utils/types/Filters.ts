import { AnyToFix } from './utils';

export type Filters<K, T extends AnyToFix = AnyToFix> = Filter<K, T>[];

export interface Filter<K, T extends AnyToFix = AnyToFix> {
  key: K;
  constants: FilterConstant<T>[];
  title: string;
  priority?: FilterConstant<T>[];
}

export type TabFilters<T> = TabFilter<T>[];

export interface TabFilter<T> {
  tag: T;
  title: string;
  active?: boolean;
}

export interface FilterConstant<T, C extends AnyToFix = AnyToFix> {
  value: T;
  label: string;
  prefix?: string | string[];
  children?: FilterConstant<C>[];
  zone?: string;
  end?: boolean;
  salesforceLabel?: string;
  public?: string;
  recommended?: string;
  color?: string;
}

export type FilterObject<
  K extends string,
  T extends AnyToFix = AnyToFix
> = Partial<Record<K, FilterConstant<T>[]>>;

export type FilterParams<K extends string> = Partial<Record<K, string[]>>;

export type TabFilterParam<K extends string> = Partial<Record<K, string[]>>;
