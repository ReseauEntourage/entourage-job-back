import { AnyCantFix } from './any.types';

export abstract class Factory<T> {
  create: (...args: AnyCantFix[]) => Promise<T>;
}
