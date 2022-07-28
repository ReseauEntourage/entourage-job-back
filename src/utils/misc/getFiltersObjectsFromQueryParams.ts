import * as _ from 'lodash';
import { FilterConstant, FilterParams } from 'src/utils/types';

export function getFiltersObjectsFromQueryParams(
  params: FilterParams,
  filtersConst: Array<{
    key: string;
    title: string;
    constants: FilterConstant[];
  }>
) {
  const filters: Record<string, Array<FilterConstant>> = {};
  if (filtersConst) {
    _.forEach(Object.keys(params), (paramKey) => {
      const filter = filtersConst.find((filterData) => {
        return filterData.key === paramKey;
      });
      if (filter) {
        const valueArray = params[paramKey];
        if (valueArray.length > 0) {
          filters[paramKey] = _.map(valueArray, (val) => {
            return filter.constants.find((constantValue) => {
              return constantValue.value.toString() === val;
            });
          });
        }
      }
    });
  }
  return filters;
}
