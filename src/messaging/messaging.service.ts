import { Injectable } from '@nestjs/common';
import { InjectModel } from '@nestjs/sequelize';
import { Op, Sequelize } from 'sequelize';
import { SlackService } from 'src/external-services/slack/slack.service';
import {
  SlackBlockConfig,
  slackChannels,
} from 'src/external-services/slack/slack.types';
import { MailsService } from 'src/mails/mails.service';
import { User } from 'src/users/models';
import { UsersService } from 'src/users/users.service';
import { ReportConversationDto } from './dto/report-conversation.dto';
import { userAttributes } from './messaging.attributes';
import {
  messagingConversationIncludes,
  messagingMessageIncludes,
} from './messaging.includes';
import { generateSlackMsgConfigConversationReported } from './messaging.utils';
import { ConversationParticipant } from './models';
import { Conversation } from './models/conversation.model';
import { Message } from './models/message.model';

@Injectable()
export class MessagingService {
  constructor(
    @InjectModel(Message)
    private messageModel: typeof Message,
    @InjectModel(Conversation)
    private conversationModel: typeof Conversation,
    @InjectModel(ConversationParticipant)
    private conversationParticipantModel: typeof ConversationParticipant,
    private slackService: SlackService,
    private userService: UsersService,
    private mailsService: MailsService
  ) {}

  /**
   * Get all conversations for a user
   */
  async getConversationsForUser(userId: string, query: string) {
    const lowerQuery = query.toLowerCase();
    const conversationParticipants =
      await this.conversationParticipantModel.findAll({
        where: {
          userId,
        },
        include: [
          {
            model: Conversation,
            as: 'conversation',
            include: [...messagingConversationIncludes(1)],
          },
        ],
        order: [
          [
            Sequelize.literal(
              '(SELECT MAX("createdAt") FROM "Messages" WHERE "Messages"."conversationId" = "conversation"."id")'
            ),
            'DESC',
          ],
        ],
      });

    return conversationParticipants
      .filter(
        (cp) =>
          cp.conversation &&
          (query === '' ||
            cp.conversation.participants.some(
              (p) =>
                p.id !== userId &&
                (p.firstName.toLowerCase().includes(lowerQuery) ||
                  p.lastName.toLowerCase().includes(lowerQuery))
            ))
      )
      .map((cp) => cp.conversation);
  }

  async getUnseenConversationsCount(userId: string) {
    return this.conversationParticipantModel.count({
      where: {
        [Op.or]: [
          {
            seenAt: {
              [Op.lt]: Sequelize.col('conversation.messages.createdAt'),
            },
          },
          {
            seenAt: null,
          },
        ],
        userId,
      },
      include: [
        {
          model: Conversation,
          as: 'conversation',
          include: [
            {
              model: Message,
              as: 'messages',
              attributes: ['createdAt'],
            },
          ],
        },
      ],
    });
  }

  /**
   * Create a new conversation with the given participants
   * @param participantIds
   */
  async createConversation(participantIds: string[]) {
    const conversation = await this.conversationModel.create({});
    await this.addMembersToConversation(conversation.id, participantIds);
    return conversation;
  }

  /**
   * Add members to a conversation
   * @param conversationId - The conversation to add members to
   * @param userIds - The users to add to the conversation
   */
  async addMembersToConversation(conversationId: string, userIds: string[]) {
    this.conversationParticipantModel.bulkCreate(
      userIds.map((userId) => ({
        conversationId,
        userId,
      }))
    );
  }

  /**
   * Create a new message
   * @param message - The message to create
   */
  async createMessage(createMessageDto: Partial<Message>) {
    const createdMessage = await this.messageModel.create(createMessageDto);
    // Set conversation as seen because the user has sent a message
    await this.setConversationHasSeen(
      createMessageDto.conversationId,
      createMessageDto.authorId
    );
    const message = await this.findOneMessage(createdMessage.id);

    // Send notification message received to the other participants
    const otherParticipants = message.conversation.participants.filter(
      (participant) => participant.id !== createMessageDto.authorId
    );
    this.mailsService.sendNewMessageNotifMail(message, otherParticipants);
    // Fetch the message to return it
    return message;
  }

  async setConversationHasSeen(conversationId: string, userId: string) {
    const conversationParticipant =
      await this.conversationParticipantModel.findOne({
        where: {
          conversationId,
          userId,
        },
      });
    if (conversationParticipant) {
      conversationParticipant.seenAt = new Date();
      await conversationParticipant.save();
    }
  }

  /**
   * Get a conversation by its ID
   * @param conversationId - The ID of the conversation to fetch
   * @param userId - The ID of the user fetching the conversation
   * @returns The conversation if the user is a participant, otherwise null
   */
  async getConversationForUser(conversationId: string, userId: string) {
    if (!(await this.isUserInConversation(conversationId, userId))) {
      return null;
    }
    const conversation = await this.conversationModel.findByPk(conversationId, {
      include: messagingConversationIncludes(),
      order: [['messages', 'createdAt', 'ASC']],
    });

    if (!conversation) {
      return null;
    }

    return conversation;
  }

  async findConversation(conversationId: string) {
    return this.conversationModel.findByPk(conversationId, {
      include: [
        {
          model: Message,
          as: 'messages',
          include: [
            {
              model: User,
              as: 'author',
              attributes: userAttributes,
              paranoid: false,
            },
          ],
          order: [['createdAt', 'DESC']],
          limit: 1,
        },
        {
          model: User,
          as: 'participants',
          attributes: userAttributes,
          paranoid: false,
        },
      ],
    });
  }

  async reportConversation(
    conversationId: string,
    reportConversationDto: ReportConversationDto,
    reporterUserId: string
  ) {
    const conversation = await this.findConversation(conversationId);
    const reporterUser = await this.userService.findOne(reporterUserId);
    const slackMsgConfig: SlackBlockConfig =
      generateSlackMsgConfigConversationReported(
        conversation,
        reportConversationDto.reason,
        reportConversationDto.comment,
        reporterUser
      );
    const slackMessage =
      this.slackService.generateSlackBlockMsg(slackMsgConfig);
    this.slackService.sendMessage(
      slackChannels.ENTOURAGE_PRO_MODERATION,
      slackMessage,
      'Conversation de la messagerie signalée'
    );
    this.mailsService.sendConversationReportedMail(
      reportConversationDto,
      conversation,
      reporterUser
    );
  }

  async findOneMessage(messageId: string) {
    return this.messageModel.findByPk(messageId, {
      include: messagingMessageIncludes,
    });
  }

  private async isUserInConversation(conversationId: string, userId: string) {
    return this.conversationParticipantModel.findOne({
      where: {
        conversationId,
        userId,
      },
    });
  }
}
