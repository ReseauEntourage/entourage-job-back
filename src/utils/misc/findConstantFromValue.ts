import { FilterConstant } from 'src/utils/types';

export function findConstantFromValue<T>(
  valToFind: T,
  constantsToFindFrom: FilterConstant<T>[]
) {
  return (
    constantsToFindFrom.find(({ value }) => {
      return value === valToFind;
    }) || {
      label: valToFind,
      value: valToFind,
    }
  );
}
