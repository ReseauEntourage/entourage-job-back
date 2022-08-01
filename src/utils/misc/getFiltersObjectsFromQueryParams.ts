import * as _ from 'lodash';
import { MemberFilterKey } from 'src/users/models';
import {
  FilterConstant,
  Filter,
  Filters,
  AnyToFix,
  FilterObject,
} from 'src/utils/types';

export function getFiltersObjectsFromQueryParams<T extends string>(
  params: Partial<Record<T, AnyToFix>>,
  filtersConst: Filters<T>
) {
  let filters = {} as FilterObject<T>;

  if (filtersConst) {
    _.forEach(Object.keys(params), (paramKey) => {
      const filter = filtersConst.find((filterData: Filter<T>) => {
        return filterData.key === paramKey;
      });
      if (filter) {
        const valueArray = params[paramKey as T];
        if (valueArray.length > 0) {
          filters = {
            ...filters,
            [paramKey as MemberFilterKey]: _.map(valueArray, (val) => {
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
