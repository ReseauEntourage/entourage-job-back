import { forwardRef, Inject, Injectable, Logger } from '@nestjs/common';
import { InjectModel } from '@nestjs/sequelize';
import chunk from 'lodash/chunk';
import { Op } from 'sequelize';
import { SlackService } from 'src/external-services/slack/slack.service';
import { slackChannels } from 'src/external-services/slack/slack.types';
import { MailsService } from 'src/mails/mails.service';
import { MessagingService } from 'src/messaging/messaging.service';
import { UsersService } from 'src/users/users.service';
import { UserRole, UserRoles } from 'src/users/users.types';
import {
  ACHIEVEMENTS_CONFIG,
  AchievementType,
  AchievementTypes,
  CriterionStat,
} from './config/achievements.config';
import { generateAchievementSlackConfig } from './gamification.utils';
import { UserAchievement } from './models/user-achievement/user-achievement.model';

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
    private slackService: SlackService,
    private mailsService: MailsService,
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
   * Returns progression stats for every achievement that exposes
   * `getProgressionStats` and for which the user's role is eligible.
   *
   * Intended to be called after an action that may advance a user's progress
   * (e.g. sending a message). The frontend uses the result to render a
   * progression modal when at least one criterion has moved forward.
   *
   * @param userId - The user's identifier
   * @param userRole - The user's role, used to filter eligible achievements
   */
  async getAllAchievementProgressions(
    userId: string,
    userRole: UserRole
  ): Promise<
    Array<{
      type: AchievementType;
      label: string;
      hasAchievement: boolean;
      achievedAt: string | null;
      expireAt: string | null;
      statsWindowMonths: number;
      criteria: CriterionStat[];
    }>
  > {
    const context = {
      userId,
      userRole,
      messagingService: this.messagingService,
    };

    const results = await Promise.all(
      ACHIEVEMENTS_CONFIG.filter((a) => a.getProgressionStats).map(
        async (achievement) => {
          const criteria = await achievement.getProgressionStats?.(context);
          if (criteria == null) return null;

          const activeRecord = await this.userAchievementModel.findOne({
            where: { userId, achievementType: achievement.type, active: true },
          });

          return {
            type: achievement.type,
            label: achievement.label,
            hasAchievement: activeRecord !== null,
            achievedAt: activeRecord?.createdAt?.toISOString() ?? null,
            expireAt: activeRecord?.expireAt?.toISOString() ?? null,
            statsWindowMonths: achievement.durationMonths,
            criteria,
          };
        }
      )
    );

    return results.filter(
      (
        r
      ): r is {
        type: AchievementType;
        label: string;
        hasAchievement: boolean;
        achievedAt: string | null;
        expireAt: string | null;
        statsWindowMonths: number;
        criteria: CriterionStat[];
      } => r !== null
    );
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
  async checkAndGrantAchievements(userId: string): Promise<{
    user: { firstName: string; lastName: string; email: string };
    grantedTypes: AchievementType[];
  }> {
    this.logger.debug(`[check] Starting achievement check for user ${userId}`);

    const user = await this.usersService.findOne(userId);
    const context = {
      userId,
      userRole: user.role,
      messagingService: this.messagingService,
    };

    const grantedTypes = (
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
            return null;
          }

          const eligible = await achievement.checkEligibility(context);
          this.logger.debug(
            `[check] ${achievement.type} — eligible=${eligible} for user ${userId}`
          );

          if (!eligible) return null;

          const userAchievement = await this.grantAchievement(
            userId,
            achievement.type,
            achievement.durationMonths
          );
          this.logger.debug(
            `[check] ${achievement.type} — granted to user ${userId}`
          );

          if (achievement.onGranted) {
            await achievement.onGranted({
              userId,
              userRole: user.role,
              expireAt: userAchievement.expireAt,
              user: {
                firstName: user.firstName,
                email: user.email,
                zone: user.zone,
              },
              mailsService: this.mailsService,
              messagingService: this.messagingService,
            });
          }

          const slackConfig = generateAchievementSlackConfig(
            user,
            achievement,
            userAchievement.expireAt,
            'granted'
          );
          await this.slackService.sendMessage(
            slackChannels.PRO_FOLLOW_ACHIEVEMENTS,
            this.slackService.generateSlackBlockMsg(slackConfig),
            `🏅 Nouveau badge décerné : ${achievement.label}`
          );

          return achievement.type;
        })
      )
    ).filter((type): type is AchievementType => type !== null);

    return {
      user: {
        firstName: user.firstName,
        lastName: user.lastName,
        email: user.email,
      },
      grantedTypes,
    };
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
        if (!config) {
          this.logger.error(
            `[processExpired] Achievement type "${achievement.achievementType}" not found in ACHIEVEMENTS_CONFIG — marking inactive to prevent infinite retries`
          );
          await achievement.update({ active: false });
          return 'skipped' as const;
        }

        const user = await this.usersService.findOne(achievement.userId);
        const baseContext = {
          userId: achievement.userId,
          userRole: user.role,
          user: {
            firstName: user.firstName,
            email: user.email,
            zone: user.zone,
          },
          mailsService: this.mailsService,
          messagingService: this.messagingService,
        };

        const eligible = await config.checkEligibility({
          userId: achievement.userId,
          userRole: user.role,
          messagingService: this.messagingService,
        });

        if (eligible) {
          const newExpireAt = new Date(achievement.expireAt);
          newExpireAt.setMonth(newExpireAt.getMonth() + config.durationMonths);
          await achievement.update({ expireAt: newExpireAt });

          if (config.onRenewed) {
            await config.onRenewed({ ...baseContext, expireAt: newExpireAt });
          }

          const slackConfig = generateAchievementSlackConfig(
            user,
            config,
            newExpireAt,
            'renewed'
          );
          await this.slackService.sendMessage(
            slackChannels.PRO_FOLLOW_ACHIEVEMENTS,
            this.slackService.generateSlackBlockMsg(slackConfig),
            `🔄 Badge renouvelé : ${config.label}`
          );

          return 'renewed' as const;
        } else {
          await achievement.update({ active: false });

          if (config.onExpired) {
            await config.onExpired({
              ...baseContext,
              expireAt: achievement.expireAt,
            });
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

  /**
   * Sends a reminder email to all coaches whose "Super Engagé" badge expires in
   * exactly 30 days, including their current stats and whether they are already
   * eligible for renewal.
   *
   * Intended to be called daily via a cron job at 10 AM.
   */
  async prepareExpirationReminderMails(): Promise<{
    total: number;
    sent: number;
    failures: Array<{ itemId: string; reason: unknown }>;
  }> {
    const today = new Date();
    const reminderDate = new Date(today);
    reminderDate.setDate(today.getDate() + 30);

    const startOfReminderDay = new Date(reminderDate);
    startOfReminderDay.setHours(0, 0, 0, 0);
    const endOfReminderDay = new Date(reminderDate);
    endOfReminderDay.setHours(23, 59, 59, 999);

    const achievements = await this.userAchievementModel.findAll({
      where: {
        active: true,
        achievementType: AchievementTypes.SUPER_ENGAGED_COACH,
        expireAt: { [Op.between]: [startOfReminderDay, endOfReminderDay] },
      },
    });

    const config = ACHIEVEMENTS_CONFIG.find(
      (a) => a.type === AchievementTypes.SUPER_ENGAGED_COACH
    );

    const results = await Promise.allSettled(
      achievements.map(async (achievement) => {
        const user = await this.usersService.findOne(achievement.userId);

        const progressionStats = await config?.getProgressionStats?.({
          userId: achievement.userId,
          userRole: UserRoles.COACH,
          messagingService: this.messagingService,
        });

        const conversationCount =
          progressionStats?.find((s) => s.key === 'conversationCount')
            ?.currentValue ?? 0;
        const responseRate =
          progressionStats?.find((s) => s.key === 'responseRate')
            ?.currentValue ?? 0;
        const goalAchieved =
          progressionStats?.every((s) => s.currentValue >= s.threshold) ??
          false;

        await this.mailsService.sendSuperEngagedAchievementReminderMail(
          { email: user.email, firstName: user.firstName, zone: user.zone },
          { conversationCount, responseRate, goalAchieved },
          achievement.expireAt
        );
      })
    );

    let sent = 0;
    const failures: Array<{ itemId: string; reason: unknown }> = [];

    results.forEach((result, index) => {
      const achievement = achievements[index];
      const itemId = `${achievement.achievementType}:${achievement.userId}`;
      if (result.status === 'rejected') {
        failures.push({ itemId, reason: result.reason });
      } else {
        sent++;
      }
    });

    return { total: achievements.length, sent, failures };
  }

  /**
   * One-time backfill: re-evaluates achievement eligibility for all non-deleted
   * coaches who have connected in the last `months` months.
   *
   * Intended to be triggered once via the admin endpoint after deploying a new
   * achievement. Results are reported to Slack on TECH_PRO_MONITORING.
   *
   * @param months - Lookback window for active users (default: 6)
   */
  async backfillAchievements(months = 6): Promise<void> {
    const BATCH_SIZE = 10;
    this.logger.log(
      `[backfill] Starting achievement backfill (last ${months} months)...`
    );

    const users = await this.usersService.findActiveCoachesInLastMonths(months);
    this.logger.log(`[backfill] Found ${users.length} eligible users`);

    const results: PromiseSettledResult<
      Awaited<ReturnType<typeof this.checkAndGrantAchievements>>
    >[] = [];

    for (const batch of chunk(users, BATCH_SIZE)) {
      const batchResults = await Promise.allSettled(
        batch.map(({ id }) => this.checkAndGrantAchievements(id))
      );
      results.push(...batchResults);
    }

    type BackfillSuccess = {
      user: { firstName: string; lastName: string; email: string };
      grantedTypes: AchievementType[];
    };

    const grantedUsers: BackfillSuccess[] = [];
    const notGrantedUsers: BackfillSuccess[] = [];
    const failedUserIds: string[] = [];

    results.forEach((result, index) => {
      if (result.status === 'rejected') {
        failedUserIds.push(users[index].id);
      } else if (result.value.grantedTypes.length > 0) {
        grantedUsers.push(result.value);
      } else {
        notGrantedUsers.push(result.value);
      }
    });

    const succeeded = failedUserIds.length === 0;

    this.logger.log(
      `[backfill] Done — ${grantedUsers.length} granted, ${notGrantedUsers.length} not eligible, ${failedUserIds.length} errors`
    );

    const formatUser = (u: BackfillSuccess['user']) =>
      `${u.firstName} ${u.lastName} (${u.email})`;

    const detailLines: string[] = [
      `*Utilisateurs ayant reçu un badge (${grantedUsers.length}) :*`,
      ...(grantedUsers.length > 0
        ? grantedUsers.map(
            (u) => `- ${formatUser(u.user)} — ${u.grantedTypes.join(', ')}`
          )
        : ['_Aucun_']),
      '',
      `*Utilisateurs non éligibles (${notGrantedUsers.length}) :*`,
    ];

    if (failedUserIds.length > 0) {
      detailLines.push(
        '',
        `*Erreurs (${failedUserIds.length}) :*`,
        ...failedUserIds.slice(0, 10).map((id) => `- ${id}`)
      );
    }

    await this.slackService.sendTechnicalMonitoringMessage(
      succeeded,
      '🏅 Backfill des badges — résultats',
      [
        {
          title: `Utilisateurs actifs (${months} mois)`,
          content: `${users.length}`,
        },
        { title: 'Badges attribués', content: `${grantedUsers.length}` },
        { title: 'Non éligibles', content: `${notGrantedUsers.length}` },
      ],
      detailLines.join('\n'),
      slackChannels.TECH_PRO_MONITORING
    );
  }
}
