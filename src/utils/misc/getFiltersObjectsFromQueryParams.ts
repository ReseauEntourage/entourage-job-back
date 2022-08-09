import * as _ from 'lodash';
import {
  FilterConstant,
  Filters,
  AnyToFix,
  FilterObject,
} from 'src/utils/types';

function findConstant<K, T>(filters: Filters<K, T>, key: K) {
  return filters.find(({ key: filterKey }) => {
    return filterKey === key;
  });
}

export function getFiltersObjectsFromQueryParams<K extends string, T>(
  params: Partial<Record<K, AnyToFix>>,
  filtersConst: Filters<K, T>
) {
  let filters = {} as FilterObject<K, T>;

  if (filtersConst) {
    _.forEach(Object.keys(params), (paramKey) => {
      const filter = findConstant<K, T>(filtersConst, paramKey as K);
      if (filter) {
        const valueArray = params[paramKey as K];
        if (valueArray.length > 0) {
          filters = {
            ...filters,
            [paramKey]: _.map(valueArray, (val) => {
              // Fix to use find function
              const constants = filter.constants.map(
                (item: FilterConstant<T>) => item
              );
              return constants.find((constantValue: FilterConstant<T>) => {
                return constantValue.value.toString() === val;
              });
            }),
          };
        }
      }
    });
  }
  return filters;
}
