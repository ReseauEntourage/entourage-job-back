import { Injectable } from '@nestjs/common';
import { App, Block, KnownBlock } from '@slack/bolt';

@Injectable()
export class SlackService {
  private app: App;

  constructor() {
    this.app = new App({
      token: process.env.SLACK_BOT_TOKEN,
      signingSecret: process.env.SLACK_SIGNING_SECRET,
    });
  }
  sendMessage = async (
    channel: string,
    blocks: (Block | KnownBlock)[],
    message: string
  ): Promise<void> => {
    try {
      await this.app.client.chat.postMessage({
        channel: channel,
        text: message,
        token: process.env.SLACK_BOT_TOKEN,
        blocks: blocks,
      });
    } catch (error) {
      console.error('SlackService - sendMessage - error: ', error);
    }
  };
}
