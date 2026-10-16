import { Injectable, Logger } from '@nestjs/common';
import { SlackService } from 'src/external-services/slack/slack.service';
import { slackChannels } from 'src/external-services/slack/slack.types';
import { User } from 'src/users/models';
import {
  findForbiddenExpression,
  parseForbiddenExpressions,
} from 'src/utils/misc/forbidden-expressions';
import { HelpGroup } from './models';

export interface ModerationAlertMessage {
  author: User;
  content: string;
  discussionId: string;
  group: Pick<HelpGroup, 'name' | 'slug'>;
  replyId?: string;
  title?: string | null;
}

/**
 * Alerts the Entourage Pro moderation Slack channel when a published or
 * edited help group message contains a forbidden expression. Never blocks
 * nor delays the publication, and never tells the author nor the readers.
 */
@Injectable()
export class HelpGroupsModerationAlertService {
  private readonly logger = new Logger(HelpGroupsModerationAlertService.name);

  constructor(private readonly slackService: SlackService) {}

  /**
   * Fire and forget: meant to be called once the write is committed.
   */
  checkMessage(message: ModerationAlertMessage): void {
    this.alertIfForbidden(message).catch((error) => {
      this.logger.warn(
        `[HelpGroupsModerationAlert] alert not sent (discussionId=${
          message.discussionId
        }): ${error instanceof Error ? error.message : String(error)}`
      );
    });
  }

  private async alertIfForbidden({
    author,
    content,
    discussionId,
    group,
    replyId,
    title,
  }: ModerationAlertMessage) {
    const expressions = parseForbiddenExpressions(
      process.env.FORBIDDEN_EXPRESSIONS
    );
    const expression = findForbiddenExpression(
      [title, content].filter(Boolean).join('\n'),
      expressions
    );
    if (!expression) {
      return;
    }

    // Same referent resolution as the messaging reports
    const referentSlackEmail = author.staffContact?.slackEmail;
    const referentSlackUserId = referentSlackEmail
      ? await this.slackService.getUserIdByEmail(referentSlackEmail)
      : null;

    const messageUrl = `${process.env.FRONT_URL}/backoffice/groupes/${
      group.slug
    }/discussions/${discussionId}${replyId ? `?replyId=${replyId}` : ''}`;

    const blocks = this.slackService.generateSlackBlockMsg({
      title: '🚨 Expression interdite dans un groupe d’entraide',
      context: [
        {
          title: 'Auteur',
          content: `${author.firstName} ${author.lastName} <${author.email}>`,
        },
        ...(referentSlackUserId
          ? [{ title: '👮 Référent', content: `<@${referentSlackUserId}>` }]
          : []),
      ],
      msgParts: [
        { content: `*Groupe* : ${group.name}` },
        { content: `*Expression détectée* : ${expression}` },
        {
          content: `*${replyId ? 'Réponse' : 'Discussion'}* : <${messageUrl}|Voir le message>`,
        },
      ],
    });
    await this.slackService.sendMessage(
      slackChannels.ENTOURAGE_PRO_MODERATION,
      blocks,
      `Expression interdite détectée dans le groupe ${group.name}`
    );
  }
}
