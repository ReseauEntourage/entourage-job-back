import { MessagingService } from 'src/messaging/messaging.service';
import { UserRole, UserRoles } from 'src/users/users.types';

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
 * Runtime context injected into `checkEligibility`.
 *
 * Extend this interface when a new achievement requires additional services
 * to evaluate its criteria (e.g. `UserProfilesService` for profile completeness).
 */
export interface AchievementContext {
  userId: string;
  userRole: UserRole;
  messagingService: MessagingService;
}

/**
 * Runtime context injected into `onRenewed` and `onExpired` callbacks.
 *
 * Intentionally separate from `AchievementContext` so that callback-specific
 * services (e.g. `MailsService`) can be added here without polluting the
 * eligibility context.
 */
export interface AchievementCallbackContext {
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
  /** Unique identifier stored in the database. Must match the migration ENUM. */
  type: AchievementType;
  /** Human-readable label, used for display purposes. */
  label: string;
  /** How long the badge remains valid once granted, in months. */
  durationMonths: number;
  /**
   * Evaluates whether the user currently meets the criteria for this achievement.
   * Called before granting and before each renewal attempt.
   * Must return `false` early if the user's role is not eligible.
   */
  checkEligibility: (ctx: AchievementContext) => Promise<boolean>;
  /**
   * Optional. Called when an active badge is successfully renewed.
   * Typical use: send a congratulations notification or email.
   */
  onRenewed?: (ctx: AchievementCallbackContext) => Promise<void>;
  /**
   * Optional. Called when a badge expires without being renewed.
   * Typical use: notify the user their badge has lapsed.
   */
  onExpired?: (ctx: AchievementCallbackContext) => Promise<void>;
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
    label: 'Super coach',
    durationMonths: 6,
    checkEligibility: async ({ userId, userRole, messagingService }) => {
      if (userRole !== UserRoles.COACH) return false;

      const [responseRate, conversationCount] = await Promise.all([
        messagingService.getResponseRate(userId),
        messagingService.getMirrorRoleConversationCount(userId),
      ]);
      return (
        responseRate !== null && responseRate >= 75 && conversationCount >= 3
      );
    },
    // onRenewed: async ({ userId }) => { /* e.g. send a congratulations email */ },
    // onExpired: async ({ userId }) => { /* e.g. send a "your badge has expired" email */ },
  },
];
