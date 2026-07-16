import { UserAchievement } from 'src/gamification/models';
import { User } from 'src/users/models';

export interface CurrentUserAchievementDto {
  achievementType: string;
  active: boolean;
  createdAt: Date;
  id: string;
  title: string;
}

export interface CurrentUserAchievementsDto {
  achievements: CurrentUserAchievementDto[];
}

export const generateCurrentUserAchievementsDto = (
  user: User
): CurrentUserAchievementsDto => ({
  achievements: (user.achievements || []).map(
    (a: UserAchievement): CurrentUserAchievementDto => ({
      id: a.id,
      achievementType: a.achievementType,
      title: a.title,
      active: a.active,
      createdAt: a.createdAt,
    })
  ),
});
