import { SlackBlockConfig } from 'src/external-services/slack/slack.types';

/**
 * Generates a business-facing Slack message config for achievement notifications.
 *
 * @param user - Basic user info for display (name, email)
 * @param achievement - The achievement definition (label)
 * @param expireAt - The badge expiration date
 * @param type - 'granted' for a new badge, 'renewed' for a renewal
 */
export const generateAchievementSlackConfig = (
  user: { firstName: string; lastName: string; email: string },
  achievement: { label: string },
  expireAt: Date,
  type: 'granted' | 'renewed'
): SlackBlockConfig => {
  const fullName = `${user.firstName} ${user.lastName}`;
  const formattedExpireAt = expireAt.toLocaleDateString('fr-FR', {
    day: 'numeric',
    month: 'long',
    year: 'numeric',
  });

  const isGranted = type === 'granted';

  return {
    title: isGranted
      ? `🏅 Nouveau badge décerné : ${achievement.label}`
      : `🔄 Badge renouvelé : ${achievement.label}`,
    context: [
      {
        title: 'Pour',
        content: `${fullName} — ${user.email}`,
      },
      {
        title: 'Badge',
        content: achievement.label,
      },
      {
        title: "Valide jusqu'au",
        content: formattedExpireAt,
      },
    ],
    msgParts: [
      {
        content: isGranted
          ? `✨ *${fullName}* vient d'obtenir le badge *${achievement.label}* !`
          : `✨ *${fullName}* a conservé son badge *${achievement.label}* !`,
      },
      {
        content: isGranted
          ? `Ce badge récompense son engagement sur la plateforme. Il est valable jusqu'au *${formattedExpireAt}*.`
          : `Son engagement se confirme dans la durée. Le badge reste actif jusqu'au *${formattedExpireAt}*.`,
      },
    ],
  };
};
