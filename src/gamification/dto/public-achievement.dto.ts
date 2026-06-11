import { AchievementType } from 'src/gamification/config/achievements.config';
import { UserAchievement } from 'src/gamification/models/user-achievement/user-achievement.model';
import { User } from 'src/users/models';
import { Gender } from 'src/users/users.types';

export interface PublicAchievementDto {
  firstName: string;
  lastName: string;
  gender: Gender;
  achievedAt: string;
  title: string;
  achievementType: AchievementType;
}

export const generatePublicAchievementDto = (
  achievement: UserAchievement & { user: User }
): PublicAchievementDto => ({
  firstName: achievement.user.firstName,
  lastName: achievement.user.lastName,
  gender: achievement.user.gender,
  achievedAt: achievement.createdAt.toISOString(),
  title: achievement.title,
  achievementType: achievement.achievementType,
});
