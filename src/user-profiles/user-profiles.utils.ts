import { searchInColumnWhereOption } from 'src/utils/misc';

export function userProfileSearchQuery(query = '') {
  return [
    searchInColumnWhereOption('user.firstName', query, true),
    searchInColumnWhereOption('user.lastName', query, true),
    searchInColumnWhereOption(
      'sectorOccupations->occupation.name',
      query,
      true
    ),
    searchInColumnWhereOption('currentJob', query, true),
  ];
}
