import { Block, KnownBlock } from '@slack/bolt';

// Each channel is configured per environment through its own env var: preprod
// and prod both run with NODE_ENV=production, so NODE_ENV can't tell them
// apart. Unset or empty variables fall back to the dev channels.
export const slackChannelEnvVars = {
  ENTOURAGE_PRO_MODERATION: 'SLACK_CHANNEL_MODERATION',
  TECH_PRO_MONITORING: 'SLACK_CHANNEL_TECH_MONITORING',
  PRO_FOLLOW_ACHIEVEMENTS: 'SLACK_CHANNEL_ACHIEVEMENTS',
} as const;

// Read lazily (not at module top-level): AppModule's ConfigModule.forRoot()
// loads the .env file after this file is imported (see src/utils/constants/zones.ts).
export const slackChannels = {
  get ENTOURAGE_PRO_MODERATION(): string {
    return (
      process.env[slackChannelEnvVars.ENTOURAGE_PRO_MODERATION] ||
      'dev-moderation_entourage-pro'
    );
  },
  get TECH_PRO_MONITORING(): string {
    return (
      process.env[slackChannelEnvVars.TECH_PRO_MONITORING] ||
      'tech-pro-monitoring-dev'
    );
  },
  get PRO_FOLLOW_ACHIEVEMENTS(): string {
    return (
      process.env[slackChannelEnvVars.PRO_FOLLOW_ACHIEVEMENTS] ||
      'dev-entourage-pro-suivi-badges'
    );
  },
};

export interface SlackMsgContextMrkdwn {
  content: string;
  title: string;
}

export interface SlackMsgContextImage {
  altText: string;
  imageUrl: string;
}

export type SlackMsgContext = SlackMsgContextMrkdwn | SlackMsgContextImage;

export interface SlackMsgPart {
  content: string;
}

export interface SlackMsgAction {
  label: string;
  // Slack only offers two colours of button: green and red
  style?: 'primary' | 'danger';
  url: string;
  value: string;
}

/**
 * A posted Slack message, kept to be rewritten later (e.g. a moderation
 * alert once its report is handled). `channel` is the channel id returned
 * by Slack, not its name.
 */
export interface SentSlackMessage {
  blocks: (Block | KnownBlock)[];
  channel: string;
  ts: string;
}

export interface SlackBlockConfig {
  actions?: SlackMsgAction[];
  context?: SlackMsgContext[];
  msgParts: SlackMsgPart[];
  title: string;
}

export type SlackMessageResponse = {
  [key: string]: unknown;
  ok: boolean;
  ts?: string;
};
