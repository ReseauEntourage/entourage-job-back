import { Op, WhereOptions } from 'sequelize';
import { User } from 'src/users/models';
import { OnboardingStatus } from 'src/users/users.types';
import { searchInColumnWhereOption } from 'src/utils/misc';
import { UserProfile } from './models';

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

/**
 * Single source of truth for whether a profile is eligible to be visible to
 * others (directory, search, recommendations, detail page): onboarding must
 * be completed AND the eLearning modules must be completed.
 *
 * Raw-SQL equivalent used in `UserProfileRecommendationsService`'s hand-written
 * CTEs (a Sequelize `WhereOptions` cannot be interpolated into raw SQL):
 *   u."onboardingStatus" = :onboardingStatusCompleted AND u."elearningCompletedAt" IS NOT NULL
 */
export const profileVisibilityEligibilityWhere: WhereOptions<User> = {
  onboardingStatus: OnboardingStatus.COMPLETED,
  elearningCompletedAt: { [Op.ne]: null },
};

/**
 * Same condition as `profileVisibilityEligibilityWhere`, expressed as a plain
 * predicate for use on an already-fetched user (e.g. the profile detail route,
 * which loads the user once and cannot re-express the check as a SQL filter).
 */
export function isProfileVisibilityEligible(
  user: Pick<User, 'onboardingStatus' | 'elearningCompletedAt'>
): boolean {
  return (
    user.onboardingStatus === OnboardingStatus.COMPLETED &&
    user.elearningCompletedAt != null
  );
}

/**
 * Translates the public "isAvailable" filter (still expressed as a boolean at
 * the API boundary) into a `WhereOptions` targeting `unavailableAt`, the
 * actual source of truth: `NULL` = available, a date = unavailable since then.
 */
export function availabilityWhere(
  isAvailable: boolean | undefined
): WhereOptions<UserProfile> {
  if (isAvailable === undefined) return {};
  return isAvailable
    ? { unavailableAt: null }
    : { unavailableAt: { [Op.ne]: null } };
}
