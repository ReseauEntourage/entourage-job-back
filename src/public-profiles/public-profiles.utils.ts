import { Op } from 'sequelize';
import { FilterObject } from 'src/utils/types';
import {
  PublicProfileFilterKey,
  PublicProfileOptions,
} from './public-profiles.types';

export function getCVOptions(
  filtersObj: FilterObject<PublicProfileFilterKey>
): PublicProfileOptions {
  let whereOptions = {} as PublicProfileOptions;

  if (filtersObj) {
    const keys = Object.keys(filtersObj) as PublicProfileFilterKey[];

    if (keys.length > 0) {
      const totalFilters = keys.reduce((acc, curr) => {
        return acc + filtersObj[curr].length;
      }, 0);

      if (totalFilters > 0) {
        for (let i = 0; i < keys.length; i += 1) {
          if (filtersObj[keys[i]].length > 0) {
            whereOptions = {
              ...whereOptions,
              [keys[i]]: {
                [Op.or]: filtersObj[keys[i]].reduce((acc, currentFilter) => {
                  if (currentFilter) {
                    if (currentFilter.children) {
                      return [...acc, ...currentFilter.children];
                    }
                    return [...acc, currentFilter.value];
                  }
                  return [...acc];
                }, []),
              },
            };
          }
        }
      }
    }
  }

  return whereOptions;
}
