import { Injectable } from '@nestjs/common';
import { App, Block, KnownBlock } from '@slack/bolt';

@Injectable()
export class SlackService {
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  sendMessage = async (
    channel: string,
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    blocks: (Block | KnownBlock)[],
    message: string
  ): Promise<void> => {
    const app = new App({
      token: process.env.SLACK_BOT_TOKEN,
      signingSecret: process.env.SLACK_SIGNING_SECRET,
    });

    try {
      await app.client.chat.postMessage({
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
