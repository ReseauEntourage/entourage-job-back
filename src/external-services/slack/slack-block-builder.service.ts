import { Injectable } from '@nestjs/common';
import { Block, KnownBlock } from '@slack/bolt';
import {
  SlackBlockConfig,
  SlackMsgAction,
  SlackMsgContext,
  SlackMsgContextImage,
  SlackMsgContextMrkdwn,
  SlackMsgPart,
} from './slack.types';

@Injectable()
export class SlackBlockBuilderService {
  public generateSlackBlockMsg = ({
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

  private generateTitleBlock = (title: string) => {
    return {
      type: 'section',
      text: {
        type: 'mrkdwn',
        text: `*${title}*`,
      },
    };
  };

  private generateDividerBlock = () => {
    return {
      type: 'divider',
    };
  };

  private generateContextBlock = (contexts: SlackMsgContext[]) => {
    // Append environment context
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

  private generateMsgPartBlock = (msgParts: SlackMsgPart[]) => {
    return {
      type: 'section',
      text: {
        type: 'mrkdwn',
        text: msgParts.map((p) => p.content).join('\n'),
      },
    };
  };

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
