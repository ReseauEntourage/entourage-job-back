import { Injectable } from '@nestjs/common';
import { InjectModel } from '@nestjs/sequelize';
import { Op } from 'sequelize';
import { SlackService } from 'src/external-services/slack/slack.service';
import {
  SlackBlockConfig,
  slackChannels,
} from 'src/external-services/slack/slack.types';
import { UserProfile } from 'src/user-profiles/models';
import { User } from 'src/users/models';
import { UsersService } from 'src/users/users.service';
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
    private userService: UsersService
  ) {}

  /**
   * Get all conversations for a user
   */
  async getConversationsForUser(userId: string, query: string) {
    // Get all conversations where ConversationParticipant exists for the given user
    const conversationParticipants =
      await this.conversationParticipantModel.findAll({
        where: {
          userId,
          [Op.or]: [
            {
              '$conversation.participants.firstName$': {
                [Op.iLike]: `%${query}%`,
              },
            },
            {
              '$conversation.participants.lastName$': {
                [Op.iLike]: `%${query}%`,
              },
            },
          ],
        },
        include: [
          {
            model: Conversation,
            as: 'conversation',
            include: [
              {
                model: Message,
                as: 'messages',
                attributes: ['id', 'content', 'createdAt', 'authorId'],
                include: [
                  {
                    model: User,
                    as: 'author',
                    attributes: ['id', 'firstName', 'lastName'],
                  },
                ],
                order: [['createdAt', 'DESC']],
                limit: 1,
              },
              {
                model: User,
                as: 'participants',
                attributes: ['id', 'firstName', 'lastName', 'role'],
              },
            ],
          },
        ],
        order: [['conversation', 'createdAt', 'DESC']],
      });
    // Return the conversations
    return conversationParticipants.map((cp) => cp.conversation);
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
    return this.messageModel.create(createMessageDto);
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
          attributes: ['id', 'firstName', 'lastName', 'gender', 'role'],
          include: [
            {
              model: UserProfile,
              attributes: ['id', 'isAvailable'],
            },
          ],
        },
      ],
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
              attributes: ['id', 'firstName', 'lastName', 'email'],
            },
          ],
          order: [['createdAt', 'DESC']],
          limit: 1,
        },
        {
          model: User,
          as: 'participants',
          attributes: ['id', 'firstName', 'lastName', 'email'],
        },
      ],
    });
  }

  async reportConversation(
    conversationId: string,
    reason: string,
    reporterUserId: string
  ) {
    const conversation = await this.findConversation(conversationId);
    const reporterUser = await this.userService.findOne(reporterUserId);
    const slackMsgConfig: SlackBlockConfig =
      generateSlackMsgConfigConversationReported(
        conversation,
        reason,
        reporterUser
      );
    const slackMessage =
      this.slackService.generateSlackBlockMsg(slackMsgConfig);
    this.slackService.sendMessage(
      slackChannels.ENTOURAGE_PRO_MODERATION,
      slackMessage,
      'Conversation de la messagerie signalée'
    );
  }

  async findOneMessage(messageId: string) {
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
