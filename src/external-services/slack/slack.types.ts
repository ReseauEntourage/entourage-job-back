export const slackChannels = {
  ENTOURAGE_PRO_MODERATION:
    process.env.NODE_ENV === 'production'
      ? 'moderation_entourage-pro'
      : 'dev-moderation_entourage-pro',
  TECH_PRO_MONITORING:
    process.env.NODE_ENV === 'production'
      ? 'tech-pro-monitoring'
      : 'tech-pro-monitoring-dev',
  PRO_FOLLOW_ACHIEVEMENTS:
    process.env.NODE_ENV === 'production'
      ? 'entourage-pro-suivi-badges'
      : 'dev-entourage-pro-suivi-badges',
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
  url: string;
  value: string;
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
