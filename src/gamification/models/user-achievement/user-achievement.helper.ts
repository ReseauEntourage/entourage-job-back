import { Includeable } from 'sequelize';
import { UserAchievement } from './user-achievement.model';

export const userAchievementAttributes = [
  'id',
  'achievementType',
  'title',
  'active',
  'createdAt',
];

export const userAchievementInclude = (): Includeable => ({
  model: UserAchievement,
  as: 'achievements',
  attributes: userAchievementAttributes,
  where: { active: true },
  required: false,
});
