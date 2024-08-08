export const slackChannels = {
  ENTOURAGE_PRO_MODERATION:
    process.env.NODE_ENV === 'production'
      ? 'moderation_entourage-pro'
      : 'dev-moderation_entourage-pro',
};

export interface SlackMsgContextMrkdwn {
  title: string;
  content: string;
}

export interface SlackMsgContextImage {
  imageUrl: string;
  altText: string;
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
  title: string;
  context?: SlackMsgContext[];
  msgParts: SlackMsgPart[];
  actions?: SlackMsgAction[];
}
