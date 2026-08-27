import { Injectable, Logger } from '@nestjs/common';
import { InjectModel } from '@nestjs/sequelize';
import { QueryTypes } from 'sequelize';
import {
  Conversation,
  ConversationActivityStatus,
  ConversationStage,
  ConversationType,
} from './models/conversation.model';
import { Message } from './models/message.model';

// Progression order used to enforce that `stage` never regresses.
const STAGE_ORDER: ConversationStage[] = [
  ConversationStage.FIRST_CONTACT_INITIATED,
  ConversationStage.CONTACT_ESTABLISHED,
  ConversationStage.LONG_TERM_SUPPORT,
];

const LONG_TERM_SUPPORT_MESSAGE_THRESHOLD = 3;
const INACTIVITY_THRESHOLD_DAYS = 30;

// French phone number, in any common formatting (spaces, dots, dashes, +33 prefix).
const PHONE_REGEX = /(\+33\s?|0)[1-9]([ .-]?\d{2}){4}/;
const EMAIL_REGEX = /[a-z0-9._%+-]+@[a-z0-9.-]+\.[a-z]{2,}/i;
// Known videoconferencing platforms. Extend this list as new platforms become common.
const MEETING_LINK_REGEX =
  /https?:\/\/([a-z0-9-]+\.)*(meet\.google\.com|zoom\.us|teams\.microsoft\.com|teams\.live\.com|whereby\.com|skype\.com)/i;

@Injectable()
export class ConversationPipelineService {
  private readonly logger = new Logger(ConversationPipelineService.name);

  constructor(
    @InjectModel(Conversation)
    private conversationModel: typeof Conversation,
    @InjectModel(Message)
    private messageModel: typeof Message
  ) {}

  /**
   * Recomputes and persists `stage` for a direct conversation, based on the number of
   * messages sent by each participant. `stage` is strictly monotone: it is only updated
   * when the newly computed stage is strictly ahead of the current one. No-op on `group`
   * conversations.
   */
  async recomputeStage(conversationId: string): Promise<void> {
    const conversation = await this.conversationModel.findByPk(conversationId);
    if (!conversation || conversation.type !== ConversationType.DIRECT) {
      return;
    }

    const newStage = await this.computeStage(conversationId);
    const currentIndex = conversation.stage
      ? STAGE_ORDER.indexOf(conversation.stage)
      : -1;
    const newIndex = STAGE_ORDER.indexOf(newStage);

    if (newIndex > currentIndex) {
      conversation.stage = newStage;
      await conversation.save();
    }
  }

  private async computeStage(
    conversationId: string
  ): Promise<ConversationStage> {
    const rows = (await this.messageModel.findAll({
      where: { conversationId },
      attributes: [
        'authorId',
        [
          this.messageModel.sequelize.fn(
            'COUNT',
            this.messageModel.sequelize.col('id')
          ),
          'count',
        ],
      ],
      group: ['authorId'],
      raw: true,
    })) as unknown as { authorId: string; count: string }[];

    if (rows.length < 2) {
      return ConversationStage.FIRST_CONTACT_INITIATED;
    }

    const minMessageCount = Math.min(...rows.map((row) => Number(row.count)));
    if (minMessageCount >= LONG_TERM_SUPPORT_MESSAGE_THRESHOLD) {
      return ConversationStage.LONG_TERM_SUPPORT;
    }

    return ConversationStage.CONTACT_ESTABLISHED;
  }

  /**
   * Marks a direct conversation as `ACTIVE`. Called whenever a new message is sent,
   * regardless of the conversation's previous `activityStatus`. No-op on `group`
   * conversations.
   */
  async markActive(conversationId: string): Promise<void> {
    const conversation = await this.conversationModel.findByPk(conversationId);
    if (!conversation || conversation.type !== ConversationType.DIRECT) {
      return;
    }
    if (conversation.activityStatus !== ConversationActivityStatus.ACTIVE) {
      conversation.activityStatus = ConversationActivityStatus.ACTIVE;
      await conversation.save();
    }
  }

  /**
   * Bulk equivalent of `markActive`, used by the daily inactivity job to switch back
   * conversations with no message in `inactivityThresholdDays` days to `INACTIVE`.
   */
  async deactivateStaleConversations(
    inactivityThresholdDays: number = INACTIVITY_THRESHOLD_DAYS
  ): Promise<string[]> {
    const threshold = new Date();
    threshold.setDate(threshold.getDate() - inactivityThresholdDays);

    const staleConversations: { id: string }[] =
      await this.conversationModel.sequelize.query(
        `
        SELECT c.id
        FROM "Conversations" c
        WHERE c.type = :type
          AND c."activityStatus" = :active
          AND (
            SELECT MAX(m."createdAt")
            FROM "Messages" m
            WHERE m."conversationId" = c.id
          ) < :threshold
      `,
        {
          type: QueryTypes.SELECT,
          replacements: {
            type: ConversationType.DIRECT,
            active: ConversationActivityStatus.ACTIVE,
            threshold,
          },
        }
      );

    const staleConversationIds = staleConversations.map((row) => row.id);
    if (staleConversationIds.length === 0) {
      return [];
    }

    await this.conversationModel.update(
      { activityStatus: ConversationActivityStatus.INACTIVE },
      { where: { id: staleConversationIds } }
    );

    return staleConversationIds;
  }

  /**
   * Detects a shared phone number, email address, or videoconferencing link in a direct
   * conversation, and sets `firstMeetingDetectedAt` to the date of the earliest such
   * message that was followed by a message from the other participant. Never overwrites
   * `firstMeetingDetectedAt` once set. No-op on `group` conversations.
   *
   * @param message - The newly created message that triggered this recompute
   */
  async detectFirstMeeting(
    conversationId: string,
    message: Message
  ): Promise<void> {
    const conversation = await this.conversationModel.findByPk(conversationId);
    if (!conversation || conversation.type !== ConversationType.DIRECT) {
      return;
    }
    if (conversation.firstMeetingDetectedAt) {
      return;
    }

    this.logger.log(
      `Evaluating first-meeting detection for conversation ${conversationId} (triggered by message ${message.id})`
    );

    const messages = await this.messageModel.findAll({
      where: { conversationId },
      order: [['createdAt', 'ASC']],
    });

    const signalMessage = messages.find((candidate) => {
      if (!this.containsMeetingSignal(candidate.content)) return false;
      return messages.some(
        (other) =>
          other.authorId !== candidate.authorId &&
          other.createdAt.getTime() > candidate.createdAt.getTime()
      );
    });

    if (signalMessage) {
      conversation.firstMeetingDetectedAt = signalMessage.createdAt;
      await conversation.save();
    }
  }

  private containsMeetingSignal(content: string): boolean {
    return (
      PHONE_REGEX.test(content) ||
      EMAIL_REGEX.test(content) ||
      MEETING_LINK_REGEX.test(content)
    );
  }
}
