import { Injectable } from '@nestjs/common';
import { InjectModel } from '@nestjs/sequelize';
import { SlackService } from 'src/external-services/slack/slack.service';
import {
  SlackBlockConfig,
  slackChannels,
} from 'src/external-services/slack/slack.types';
import { User } from 'src/users/models';
import { UsersService } from 'src/users/users.service';
import { generateSlackMsgConfigMessageReported } from './messaging.utils';
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
    private userService: UsersService
  ) {}

  /**
   * Create a new conversation with the given participants
   * @param participantIds
   */
  async createConversation(participantIds: string[]) {
    const conversation = await this.conversationModel.create({});
    this.addMembersToConversation(conversation.id, participantIds);
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
    return this.messageModel.create(createMessageDto);
  }

  /**
   * Get a conversation by its ID
   * @param conversationId - The ID of the conversation to fetch
   * @param userId - The ID of the user fetching the conversation
   * @returns The conversation if the user is a participant, otherwise null
   */
  async getConversation(conversationId: string, userId: string) {
    if (!(await this.isUserInConversation(conversationId, userId))) {
      return null;
    }
    const conversation = await this.conversationModel.findByPk(conversationId, {
      include: [
        {
          model: Message,
          as: 'messages',
          include: [
            {
              model: User,
              as: 'author',
              attributes: ['id', 'firstName', 'lastName', 'gender'],
            },
          ],
          attributes: ['id', 'content', 'createdAt'],
        },
        {
          model: User,
          as: 'participants',
          attributes: ['id', 'firstName', 'lastName', 'gender'],
        },
      ],
      order: [['messages', 'createdAt', 'ASC']],
    });

    if (!conversation) {
      return null;
    }

    return conversation;
  }

  async reportMessageAbuse(
    messageId: string,
    reason: string,
    reporterUserId: string
  ) {
    const message = await this.findOneMessage(messageId);
    const senderUser = await this.userService.findOne(message.authorId);
    const reporterUser = await this.userService.findOne(reporterUserId);
    const slackMsgConfig: SlackBlockConfig =
      generateSlackMsgConfigMessageReported(
        message,
        reason,
        senderUser,
        reporterUser
      );
    const slackMessage =
      this.slackService.generateSlackBlockMsg(slackMsgConfig);
    this.slackService.sendMessage(
      slackChannels.ENTOURAGE_PRO_MODERATION,
      slackMessage,
      'Message signalé'
    );
  }

  private async findOneMessage(messageId: string) {
    return this.messageModel.findByPk(messageId, {
      include: [
        {
          model: Conversation,
          as: 'conversation',
          attributes: ['id'],
          include: [
            {
              model: User,
              as: 'participants',
              attributes: ['id', 'firstName', 'lastName', 'email'],
            },
          ],
        },
        {
          model: User,
          as: 'author',
          attributes: ['id', 'firstName', 'lastName', 'email'],
        },
      ],
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
