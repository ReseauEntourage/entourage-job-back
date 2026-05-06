import { UserAchievement } from 'src/gamification/models';
import { User } from 'src/users/models';

export interface CurrentUserAchievementDto {
  id: string;
  achievementType: string;
  title: string;
  active: boolean;
  createdAt: Date;
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
