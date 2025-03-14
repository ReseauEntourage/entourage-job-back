import { HttpException, HttpStatus, Injectable } from '@nestjs/common';
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
import { PostFeedbackDto } from './dto';
import { UserRoles } from 'src/users/users.types';
import { ReportConversationDto } from './dto/report-conversation.dto';
import { userAttributes } from './messaging.attributes';
import {
  messagingConversationIncludes,
  messagingMessageIncludes,
} from './messaging.includes';
import {
  determineIfShoudGiveFeedback,
  generateSlackMsgConfigConversationReported,
  generateSlackMsgConfigUserSuspiciousUser,
} from './messaging.utils';
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
  async getConversationsForUser(userId: string) {
    const conversationParticipants =
      await this.conversationParticipantModel.findAll({
        where: {
          userId,
        },
        include: [
          {
            model: Conversation,
            as: 'conversation',
            include: [...messagingConversationIncludes(10)],
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
      .filter((cp) => cp.conversation)
      .map((cp) => {
        const shouldGiveFeedback = determineIfShoudGiveFeedback(
          cp.conversation,
          cp.feedbackRating,
          cp.feedbackDate
        );
        return {
          ...cp.conversation.toJSON(),
          shouldGiveFeedback,
          createdAt: cp.createdAt,
          updatedAt: cp.updatedAt,
          seenAt: cp.seenAt,
        };
      });
  }

  /**
   * Get a conversation by its ID
   * @param conversationId - The ID of the conversation to fetch
   * @param userId - The ID of the user fetching the conversation
   * @returns The conversation if the user is a participant, otherwise null
   */
  async getConversationById(conversationId: string, userId: string) {
    const conversationParticipants =
      await this.conversationParticipantModel.findAll({
        where: {
          userId,
          conversationId,
        },
        include: [
          {
            model: Conversation,
            as: 'conversation',
            include: [...messagingConversationIncludes()],
          },
        ],
      });

    const cp = conversationParticipants[0];

    if (!cp) {
      return null;
    }

    const shouldGiveFeedback = determineIfShoudGiveFeedback(
      cp.conversation,
      cp.feedbackRating,
      cp.feedbackDate
    );

    return {
      ...cp.conversation.toJSON(),
      shouldGiveFeedback,
      createdAt: cp.createdAt,
      updatedAt: cp.updatedAt,
      seenAt: cp.seenAt,
    };
  }

  async getUnseenConversationsCount(userId: string) {
    const unseenConversations = await this.conversationParticipantModel.findAll(
      {
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
      }
    );
    const useenConversationIds = unseenConversations.map(
      (c) => c.conversationId
    );

    const userConversations = await this.getConversationsForUser(userId);

    // extract conversation ids where conversation.shouldGiveFeedback is true
    const conversationsWithFeedbackRequired = userConversations
      .filter((conv) => conv.shouldGiveFeedback)
      .map((conv) => conv.id);

    // count unique conversations ids in unseenConversationIds ad conversationsWithFeedbackRequired
    return new Set([
      ...useenConversationIds,
      ...conversationsWithFeedbackRequired,
    ]).size;
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
    const otherParticipants = message.conversation.participants
      .filter((participant) => participant.id !== createMessageDto.authorId)
      .map((participant) => participant.user);
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

  async countDailyConversations(userId: string) {
    return this.conversationParticipantModel.count({
      where: {
        userId,
        createdAt: {
          [Op.gte]: new Date(new Date().setHours(0, 0, 0, 0)),
        },
      },
    });
  }

  async handleDailyConversationLimit(user: User, message: string) {
    if (user.role === UserRoles.ADMIN) {
      // Admins can create as many conversations as they want
      return;
    }
    const countDailyConversation = await this.countDailyConversations(user.id);
    if (countDailyConversation === 4 || countDailyConversation >= 7) {
      const slackMsgConfig: SlackBlockConfig =
        generateSlackMsgConfigUserSuspiciousUser(
          user,
          `Un utilisateur tente de créer sa ${
            countDailyConversation + 1
          }ème conversation aujourd\'hui`,
          message
        );
      const slackMessage =
        this.slackService.generateSlackBlockMsg(slackMsgConfig);
      this.slackService.sendMessage(
        slackChannels.ENTOURAGE_PRO_MODERATION,
        slackMessage,
        'Conversation de la messagerie signalée'
      );
    }

    if (countDailyConversation >= 7) {
      throw new HttpException(
        'DAILY_CONVERSATION_LIMIT_REACHED',
        HttpStatus.TOO_MANY_REQUESTS
      );
    }
  }

  /**
   * Post a feedback on a conversation
   */
  async postFeedback(postFeedbackDto: PostFeedbackDto) {
    const conversationParticipant =
      await this.conversationParticipantModel.findByPk(
        postFeedbackDto.conversationParticipantId
      );

    if (!conversationParticipant) {
      return;
    }

    const updatedParticipant = await conversationParticipant.update({
      feedbackRating: postFeedbackDto.rating,
      feedbackDate: new Date(),
    });

    return updatedParticipant;
  }
}
