import { Injectable } from '@nestjs/common';
import { App, Block, KnownBlock } from '@slack/bolt';
import { User } from 'src/users/models';
import {
  SlackBlockConfig,
  slackChannels,
  SlackMsgAction,
  SlackMsgContext,
  SlackMsgContextImage,
  SlackMsgContextMrkdwn,
  SlackMsgPart,
} from './slack.types';

@Injectable()
export class SlackService {
  private app: App;

  constructor() {
    this.app = new App({
      token: process.env.SLACK_BOT_TOKEN,
      signingSecret: process.env.SLACK_SIGNING_SECRET,
    });
  }

  /**
   * Send a slack message
   * @param channel - The Channel to send the message
   * @param blocks - The message as blocks to send
   * @param message - The message as string to send
   */
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

  sendMessageUserReported = async (
    userReporter: User,
    userReported: User,
    reason: string,
    comment: string
  ): Promise<void> => {
    return this.sendMessage(
      slackChannels.ENTOURAGE_PRO_MODERATION,
      this.generateProfileReportedBlocks(
        userReporter,
        userReported,
        reason,
        comment
      ),
      `Le profil de ${userReported.firstName} ${userReported.lastName} a été signalé`
    );
  };

  /**
   * Generate a the slack blocks for a message
   * @param param0 message configuration
   * @returns blocks for the message
   */
  generateSlackBlockMsg = ({
    title,
    context,
    msgParts,
    actions,
  }: SlackBlockConfig): (Block | KnownBlock)[] => {
    const blocksBuffer = [];

    // Title
    blocksBuffer.push(this.generateTitleBlock(title));

    // Divider
    blocksBuffer.push(this.generateDividerBlock());

    // Context with divider
    if (context && context.length) {
      blocksBuffer.push(this.generateContextBlock(context));
      blocksBuffer.push(this.generateDividerBlock());
    }

    // Message parts with divider
    if (msgParts.length) {
      blocksBuffer.push(this.generateMsgPartBlock(msgParts));
      blocksBuffer.push(this.generateDividerBlock());
    }

    // Actions with divider
    if (actions && actions.length) {
      blocksBuffer.push(this.generateActionsBlock(actions));
      blocksBuffer.push(this.generateDividerBlock());
    }
    return blocksBuffer;
  };

  /**
   * Generate a slack message for a profile reported
   * @param userReporter - The user who reported
   * @param userReported - The user who was reported
   * @param reason - The reason of the report
   * @param comment - The comment of the report
   * @returns blocks for the message
   */
  generateProfileReportedBlocks = (
    userReporter: User,
    userReported: User,
    reason: string,
    comment: string
  ) => {
    return this.generateSlackBlockMsg({
      title: '🚨 Un profil a été signalé',
      context: [
        {
          title: 'Signalé par',
          content: `\n${userReporter.firstName} ${userReporter.lastName} <${userReporter.email}>`,
        },
      ],
      msgParts: [
        {
          content: `Profil signalé : ${userReported.firstName} ${userReported.lastName} <${userReported.email}>`,
        },
        {
          content: `Raison du signalement : ${reason}`,
        },
        {
          content: `Commentaire : ${comment}`,
        },
      ],
    });
  };

  /***************** */
  /* Private methods */
  /***************** */

  /**
   * Generate title block
   * @param title - The title
   * @returns The title block
   */
  private generateTitleBlock = (title: string) => {
    return {
      type: 'section',
      text: {
        type: 'mrkdwn',
        text: `*${title}*`,
      },
    };
  };

  /**
   * Generate divider block
   * @returns The divider block
   */
  private generateDividerBlock = () => {
    return {
      type: 'divider',
    };
  };

  /**
   * Generate context block
   * @param contexts The context configuration
   * @returns The context block
   */
  private generateContextBlock = (contexts: SlackMsgContext[]) => {
    // Append environment context before generate
    contexts.push({
      title: 'Environnement',
      content: process.env.HEROKU_APP_NAME,
    });

    return {
      type: 'context',
      elements: contexts.map((context) => {
        if (
          context.hasOwnProperty('imageUrl') &&
          context.hasOwnProperty('altText')
        ) {
          const c = context as SlackMsgContextImage;
          return {
            type: 'image',
            image_url: c.imageUrl,
            alt_text: c.altText,
          };
        } else {
          const c = context as SlackMsgContextMrkdwn;
          return {
            type: 'mrkdwn',
            text: `${c.title}: ${c.content}`,
          };
        }
      }),
    } as Block;
  };

  /**
   * Generate message part block
   * @param msgParts message parts configuration
   * @returns The message part block
   */
  private generateMsgPartBlock = (msgParts: SlackMsgPart[]) => {
    return {
      type: 'section',
      text: {
        type: 'mrkdwn',
        text: msgParts.map((p) => p.content).join('\n'),
      },
    };
  };

  /**
   * Generate actions block
   * @param actions action configuration
   * @returns The actions block
   */
  private generateActionsBlock = (actions: SlackMsgAction[]) => {
    return {
      type: 'actions',
      elements: actions.map((action, idx) => ({
        type: 'button',
        text: {
          type: 'plain_text',
          text: action.label,
          emoji: true,
        },
        value: `action-${idx}}`,
        url: action.url,
      })),
    };
  };
}
