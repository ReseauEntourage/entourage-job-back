import { AnyToFix } from './any.types';

export type Filters<K, T extends AnyToFix = AnyToFix> = Filter<K, T>[];

export interface Filter<K, T extends AnyToFix = AnyToFix> {
  constants: FilterConstant<T>[];
  key: K;
  priority?: FilterConstant<T>[];
  title: string;
}

export type TabFilters<T> = TabFilter<T>[];

export interface TabFilter<T> {
  active?: boolean;
  tag: T;
  title: string;
}

export interface FilterConstant<T, C extends AnyToFix = AnyToFix> {
  __isNew__?: boolean;
  children?: FilterConstant<C>[];
  color?: string;
  end?: boolean;
  label: string;
  prefix?: string | string[];
  public?: string;
  recommended?: string;
  salesforceLabel?: string;
  value: T;
  zone?: string;
}

export type FilterObject<
  K extends string,
  T extends AnyToFix = AnyToFix,
> = Partial<Record<K, FilterConstant<T>[]>>;

export type FilterParams<K extends string> = Partial<Record<K, string[]>>;

export type TabFilterParam<K extends string> = Partial<Record<K, string[]>>;
