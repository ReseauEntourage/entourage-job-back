import { MailsService } from 'src/mails/mails.service';
import { MessagingService } from 'src/messaging/messaging.service';
import { UserRole, UserRoles } from 'src/users/users.types';
import { InternalStaffContact, ZoneName } from 'src/utils/types/zones.types';

/**
 * Exhaustive registry of all achievement types available on the platform.
 *
 * Adding a new achievement requires:
 * 1. Adding its key here
 * 2. Adding the corresponding value to the migration ENUM
 * 3. Adding its `AchievementDefinition` entry to `ACHIEVEMENTS_CONFIG`
 */
export const AchievementTypes = {
  SUPER_ENGAGED_COACH: 'super_engaged_coach',
} as const;

/** Union type derived from `AchievementTypes` — used for strong typing across the module. */
export type AchievementType =
  (typeof AchievementTypes)[keyof typeof AchievementTypes];

/**
 * Represents a single measurable criterion for an achievement.
 *
 * Used to power the progression modal on the frontend: each criterion
 * exposes its current value and the threshold to reach, so the UI can
 * render progress bars and descriptive text without hardcoding any thresholds.
 */
export interface CriterionStat {
  /** The user's current value for this criterion. */
  currentValue: number;
  /** When true, values are displayed as percentages in the UI (e.g. "75%" instead of "75 / 100"). */
  isPercentage?: boolean;
  /** Machine identifier, e.g. "responseRate" or "conversationCount". */
  key: string;
  /** Human-readable label displayed in the UI. */
  label: string;
  /** The minimum value required to satisfy this criterion. */
  threshold: number;
}

/**
 * Runtime context injected into `checkEligibility`.
 *
 * Extend this interface when a new achievement requires additional services
 * to evaluate its criteria (e.g. `UserProfilesService` for profile completeness).
 */
export interface AchievementContext {
  messagingService: MessagingService;
  userId: string;
  userRole: UserRole;
}

/**
 * Minimal user data available in lifecycle callbacks.
 * Pre-fetched by `GamificationService` to avoid redundant DB queries.
 */
export interface AchievementCallbackUser {
  email: string;
  firstName: string;
  staffContact: InternalStaffContact;
  zone: ZoneName | null;
}

/**
 * Runtime context injected into `onGranted`, `onRenewed`, and `onExpired` callbacks.
 *
 * Intentionally separate from `AchievementContext` so that callback-specific
 * services (e.g. `MailsService`) can be added here without polluting the
 * eligibility context.
 */
export interface AchievementCallbackContext {
  /** The UUID of the UserAchievement record just created or renewed. */
  achievementId: string;
  /** The badge's expiration date — use as nextEvaluationDate in notifications. */
  expireAt: Date;
  mailsService: MailsService;
  messagingService: MessagingService;
  /** Pre-fetched user data available at callback time. */
  user: AchievementCallbackUser;
  userId: string;
  userRole: UserRole;
}

/**
 * Describes a single achievement: its eligibility criteria, validity duration,
 * and optional lifecycle callbacks.
 *
 * Each entry in `ACHIEVEMENTS_CONFIG` must implement this interface.
 */
export interface AchievementDefinition {
  /**
   * Evaluates whether the user currently meets the criteria for this achievement.
   * Called before granting and before each renewal attempt.
   * Must return `false` early if the user's role is not eligible.
   */
  checkEligibility: (ctx: AchievementContext) => Promise<boolean>;
  /** How long the badge remains valid once granted, in months. */
  durationMonths: number;
  /**
   * Optional. Returns the current progression stats for this achievement.
   *
   * Called by `GamificationService.getAllAchievementProgressions` to power
   * the in-app progression modal shown after a triggering action (e.g. sending
   * a message).
   *
   * Return `null` if the user's role is not eligible for this achievement —
   * the service will exclude this achievement from the response entirely.
   *
   * Adding a new achievement with a progression UI only requires implementing
   * this method here; no changes to the service or controller are needed.
   */
  getProgressionStats?: (
    ctx: AchievementContext
  ) => Promise<CriterionStat[] | null>;
  /** Human-readable label, used for display purposes. */
  label: string;
  /**
   * Optional. Called when a badge expires without being renewed.
   * Typical use: notify the user their badge has lapsed.
   */
  onExpired?: (ctx: AchievementCallbackContext) => Promise<void>;
  /**
   * Optional. Called immediately after the badge is first granted.
   * Typical use: send a congratulations notification or email.
   */
  onGranted?: (ctx: AchievementCallbackContext) => Promise<void>;
  /**
   * Optional. Called when an active badge is successfully renewed.
   * Typical use: send a congratulations notification or email.
   */
  onRenewed?: (ctx: AchievementCallbackContext) => Promise<void>;
  /** Unique identifier stored in the database. Must match the migration ENUM. */
  type: AchievementType;
}

/**
 * Central registry of all achievements.
 *
 * This is the single source of truth consumed by `GamificationService` for:
 * - Evaluating eligibility when granting (`checkAndGrantAchievements`)
 * - Deciding whether to renew or expire a badge (`processExpiredAchievements`)
 * - Firing lifecycle callbacks on renewal and expiration
 *
 * Each entry is self-contained: adding a new achievement only requires
 * extending this array — no changes to `GamificationService` are needed.
 */
export const ACHIEVEMENTS_CONFIG: AchievementDefinition[] = [
  {
    type: AchievementTypes.SUPER_ENGAGED_COACH,
    label: 'Super Engagé',
    durationMonths: 6,
    checkEligibility: async ({ userId, userRole, messagingService }) => {
      if (userRole !== UserRoles.COACH) return false;

      const [responseRate, conversationCount] = await Promise.all([
        messagingService.getResponseRate(userId),
        messagingService.getMirrorRoleConversationCount(userId, userRole, 6),
      ]);
      return (
        responseRate !== null && responseRate >= 75 && conversationCount >= 3
      );
    },
    getProgressionStats: async ({ userId, userRole, messagingService }) => {
      if (userRole !== UserRoles.COACH) return null;

      const [responseRate, conversationCount] = await Promise.all([
        messagingService.getResponseRate(userId),
        messagingService.getMirrorRoleConversationCount(userId, userRole, 6),
      ]);

      return [
        {
          key: 'conversationCount',
          label: 'Candidats aidés',
          currentValue: conversationCount,
          threshold: 3,
        },
        {
          key: 'responseRate',
          label: 'Taux de réponse',
          currentValue: responseRate ?? 0,
          threshold: 75,
          isPercentage: true,
        },
      ];
    },
    onGranted: async ({
      achievementId,
      user,
      userId,
      userRole,
      expireAt,
      mailsService,
      messagingService,
    }) => {
      const [responseRate, conversationCount] = await Promise.all([
        messagingService.getResponseRate(userId),
        messagingService.getMirrorRoleConversationCount(userId, userRole, 6),
      ]);
      await mailsService.sendSuperEngagedAchievementMail(
        user,
        { conversationCount, responseRate: responseRate ?? 0 },
        expireAt,
        achievementId
      );
    },
    onRenewed: async ({
      achievementId,
      user,
      userId,
      userRole,
      expireAt,
      mailsService,
      messagingService,
    }) => {
      const [responseRate, conversationCount] = await Promise.all([
        messagingService.getResponseRate(userId),
        messagingService.getMirrorRoleConversationCount(userId, userRole, 6),
      ]);
      await mailsService.sendSuperEngagedAchievementMail(
        user,
        { conversationCount, responseRate: responseRate ?? 0 },
        expireAt,
        achievementId
      );
    },
    onExpired: async ({
      user,
      userId,
      userRole,
      mailsService,
      messagingService,
    }) => {
      const [responseRate, conversationCount] = await Promise.all([
        messagingService.getResponseRate(userId),
        messagingService.getMirrorRoleConversationCount(userId, userRole, 6),
      ]);
      await mailsService.sendSuperEngagedAchievementExpiredMail(user, {
        conversationCount,
        responseRate: responseRate ?? 0,
      });
    },
  },
];
