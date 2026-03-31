import { forwardRef, Inject, Injectable, Logger } from '@nestjs/common';
import { InjectModel } from '@nestjs/sequelize';
import { Op } from 'sequelize';
import { MessagingService } from 'src/messaging/messaging.service';
import { UsersService } from 'src/users/users.service';
import {
  ACHIEVEMENTS_CONFIG,
  AchievementType,
} from './config/achievements.config';
import { UserAchievement } from './models/user-achievement.model';

/**
 * Handles the full lifecycle of user achievements.
 *
 * Responsibilities:
 * - Evaluating eligibility against criteria defined in `ACHIEVEMENTS_CONFIG`
 * - Granting a badge when all criteria are met
 * - Processing expired badges daily: renewing those whose users are still eligible,
 *   expiring the rest — in a single pass via `processExpiredAchievements`
 * - Firing `onRenewed` / `onExpired` lifecycle callbacks defined in the config
 *
 * Business rules for each achievement are encapsulated in
 * `src/gamification/config/achievements.config.ts`, keeping this service
 * agnostic of individual badge logic and easy to extend with new achievements.
 */
@Injectable()
export class GamificationService {
  private readonly logger = new Logger(GamificationService.name);

  constructor(
    @InjectModel(UserAchievement)
    private userAchievementModel: typeof UserAchievement,
    @Inject(forwardRef(() => MessagingService))
    private messagingService: MessagingService,
    @Inject(forwardRef(() => UsersService))
    private usersService: UsersService
  ) {}

  /**
   * Returns all currently active achievements for a given user.
   *
   * @param userId - The user's identifier
   * @returns List of `UserAchievement` records where `active` is `true`
   */
  async getUserActiveAchievements(userId: string): Promise<UserAchievement[]> {
    return this.userAchievementModel.findAll({
      where: { userId, active: true },
    });
  }

  /**
   * Checks whether a user already holds an active badge of a given type.
   *
   * Used before granting to prevent duplicates: a user cannot receive the
   * same badge twice within an active period.
   *
   * @param userId - The user's identifier
   * @param achievementType - The badge type to check
   * @returns `true` if an active badge of this type already exists, `false` otherwise
   */
  async hasActiveAchievement(
    userId: string,
    achievementType: AchievementType
  ): Promise<boolean> {
    const count = await this.userAchievementModel.count({
      where: { userId, achievementType, active: true },
    });
    return count > 0;
  }

  /**
   * Grants a badge to a user with an expiration date computed from the
   * duration defined in the achievement configuration.
   *
   * @param userId - The recipient user's identifier
   * @param achievementType - The badge type to grant
   * @param durationMonths - How long the badge remains valid, in months
   * @returns The newly created `UserAchievement` record
   */
  async grantAchievement(
    userId: string,
    achievementType: AchievementType,
    durationMonths: number
  ): Promise<UserAchievement> {
    const expireAt = new Date();
    expireAt.setMonth(expireAt.getMonth() + durationMonths);

    return this.userAchievementModel.create({
      userId,
      achievementType,
      expireAt,
      active: true,
    });
  }

  /**
   * Iterates over all configured achievements and grants any for which the
   * user is eligible.
   *
   * For each achievement:
   * 1. Skips if the user already holds an active badge of that type
   * 2. Evaluates eligibility via `checkEligibility` (defined in config)
   * 3. Grants the badge if all criteria are satisfied
   *
   * This is the main entry point, called after each message is sent
   * (via the `transaction.afterCommit` callback in `MessagingService`).
   *
   * @param userId - The user's identifier to evaluate
   */
  async checkAndGrantAchievements(userId: string): Promise<void> {
    this.logger.log(`[check] Starting achievement check for user ${userId}`);

    const user = await this.usersService.findOne(userId);
    const context = {
      userId,
      userRole: user.role,
      messagingService: this.messagingService,
    };

    await Promise.all(
      ACHIEVEMENTS_CONFIG.map(async (achievement) => {
        const alreadyActive = await this.hasActiveAchievement(
          userId,
          achievement.type
        );
        if (alreadyActive) {
          this.logger.debug(
            `[check] ${achievement.type} — skipped (already active) for user ${userId}`
          );
          return;
        }

        const eligible = await achievement.checkEligibility(context);
        this.logger.log(
          `[check] ${achievement.type} — eligible=${eligible} for user ${userId}`
        );

        if (eligible) {
          await this.grantAchievement(
            userId,
            achievement.type,
            achievement.durationMonths
          );
          this.logger.log(
            `[check] ${achievement.type} — granted to user ${userId}`
          );
        }
      })
    );
  }

  /**
   * Processes all badges whose `expireAt` date is in the past.
   *
   * For each expired badge:
   * 1. Looks up its definition in the configuration
   * 2. Re-evaluates the user's eligibility over the current rolling window
   * 3a. If still eligible: extends `expireAt` by `durationMonths` from the current
   *     expiration date (no gap, no overlap) and fires `onRenewed`
   * 3b. If no longer eligible: marks the badge as inactive and fires `onExpired`
   *
   * This single method replaces the former two-step expire → renew flow.
   * The eligibility check acts as a safety net: even if a cron previously failed,
   * a user who still meets the criteria will never lose their badge.
   *
   * Intended to be called daily via a cron job.
   */
  async processExpiredAchievements(): Promise<{
    total: number;
    renewed: number;
    expired: number;
    failures: Array<{ itemId: string; reason: unknown }>;
  }> {
    const expiredAchievements = await this.userAchievementModel.findAll({
      where: { active: true, expireAt: { [Op.lt]: new Date() } },
    });

    const results = await Promise.allSettled(
      expiredAchievements.map(async (achievement) => {
        const config = ACHIEVEMENTS_CONFIG.find(
          (c) => c.type === achievement.achievementType
        );
        if (!config) return 'skipped' as const;

        const user = await this.usersService.findOne(achievement.userId);
        const callbackContext = {
          userId: achievement.userId,
          userRole: user.role,
        };

        const eligible = await config.checkEligibility({
          ...callbackContext,
          messagingService: this.messagingService,
        });

        if (eligible) {
          const newExpireAt = new Date(achievement.expireAt);
          newExpireAt.setMonth(newExpireAt.getMonth() + config.durationMonths);
          await achievement.update({ expireAt: newExpireAt });

          if (config.onRenewed) {
            await config.onRenewed(callbackContext);
          }
          return 'renewed' as const;
        } else {
          await achievement.update({ active: false });

          if (config.onExpired) {
            await config.onExpired(callbackContext);
          }
          return 'expired' as const;
        }
      })
    );

    let renewed = 0;
    let expired = 0;
    const failures: Array<{ itemId: string; reason: unknown }> = [];

    results.forEach((result, index) => {
      const achievement = expiredAchievements[index];
      const itemId = `${achievement.achievementType}:${achievement.userId}`;

      if (result.status === 'rejected') {
        failures.push({ itemId, reason: result.reason });
      } else if (result.value === 'renewed') {
        renewed++;
      } else if (result.value === 'expired') {
        expired++;
      }
    });

    return { total: expiredAchievements.length, renewed, expired, failures };
  }
}
