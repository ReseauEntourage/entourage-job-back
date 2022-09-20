import { FilterConstant } from 'src/utils/types';

export function findConstantFromValue<T>(
  valToFind: T,
  constantsToFindFrom: FilterConstant<T>[]
): FilterConstant<T> {
  return (
    constantsToFindFrom.find(({ value }) => {
      return value === valToFind;
    }) ||
    ({
      label: valToFind.toString(),
      value: valToFind,
    } as FilterConstant<T>)
  );
}
