import { Includeable } from 'sequelize';
import { UserFeatureFlag } from './user-feature-flag.model';

export const userFeatureFlagInclude = (): Includeable => ({
  model: UserFeatureFlag,
  as: 'featureFlags',
  attributes: ['featureKey', 'enabled'],
  required: false,
});
