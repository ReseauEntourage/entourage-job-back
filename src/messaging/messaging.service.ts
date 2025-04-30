import {
  BadRequestException,
  forwardRef,
  HttpException,
  HttpStatus,
  Inject,
  Injectable,
} from '@nestjs/common';
import { InjectModel } from '@nestjs/sequelize';
import { Op, Sequelize } from 'sequelize';
import { SlackService } from 'src/external-services/slack/slack.service';
import {
  SlackBlockConfig,
  slackChannels,
} from 'src/external-services/slack/slack.types';
import { MailsService } from 'src/mails/mails.service';
import { MediasService } from 'src/medias/medias.service';
import { Media } from 'src/medias/models';
import { User } from 'src/users/models';
import { UsersService } from 'src/users/users.service';
import { UserRoles } from 'src/users/users.types';
import { CreateMessageDto, PostFeedbackDto } from './dto';
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
import { ConversationParticipant, MessageMedia } from './models';
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
    @InjectModel(MessageMedia)
    private messageMediaModel: typeof MessageMedia,
    private slackService: SlackService,
    @Inject(forwardRef(() => UsersService))
    private userService: UsersService,
    private mailsService: MailsService,
    private mediaService: MediasService
  ) {}

  /**
   * User can participate to a conversation
   */
  async canParticipate(userId: string, createMessageDto: CreateMessageDto) {
    if (!createMessageDto.conversationId && !createMessageDto.participantIds) {
      throw new BadRequestException(
        'Vous devez fournir un identifiant de conversation ou une liste de participants.'
      );
    }

    // Ignore if the conversationId is not provided but the participantIds are
    if (!createMessageDto.conversationId && createMessageDto.participantIds) {
      return true;
    }

    const conversation = await this.findConversation(
      createMessageDto.conversationId
    );
    if (
      !conversation.participants.some(
        (participant) => participant.id === userId
      )
    ) {
      return false;
    }

    return true;
  }

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

    const conversationMedias = await this.findMediasByConversationId(
      conversationId
    );

    cp.conversation.messages.forEach((message) => {
      const messageMedias = conversationMedias.filter((media) =>
        message.medias.map((m) => m.id).includes(media.id)
      );
      message.setDataValue('medias', messageMedias);
    });

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
  async createMessage(
    createMessageDto: Partial<
      Message & {
        files: Express.Multer.File[];
        mediaIds?: string[];
      }
    >
  ) {
    if (createMessageDto.files) {
      const mediaRecords = await this.mediaService.bulkUploadAndCreateMedias(
        createMessageDto.files,
        createMessageDto.authorId
      );
      createMessageDto.mediaIds = mediaRecords.map((media: Media) => media.id);
    }
    const createdMessage = await this.messageModel.create(createMessageDto);
    if (createMessageDto.mediaIds && createMessageDto.mediaIds.length > 0) {
      await this.addMediasToMessage(
        createdMessage.id,
        createMessageDto.mediaIds
      );
    }
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

  async addMediasToMessage(messageId: string, mediasId: string[]) {
    if (mediasId.length === 0) {
      return;
    }
    await this.messageMediaModel.bulkCreate(
      mediasId.map((mediaId) => ({
        messageId,
        mediaId,
      }))
    );
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
          include: messagingMessageIncludes,
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
    const message = await this.messageModel.findByPk(messageId, {
      include: messagingMessageIncludes,
    });
    const medias = await this.mediaService.findMediaByMessageId(messageId);
    // Link medias to the message
    message.setDataValue('medias', medias);
    return message;
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

  async findMediasByConversationId(conversationId: string) {
    return this.mediaService.findMediasByConversationId(conversationId);
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

  /**
   * Compute the average delay response for a user profile (in days)
   * Based on the 10 last messages of each conversation excluding the last message (can be a message that don't need a response)
   * and the messages sent by the user.
   *
   * @param userProfileId - The ID of the user profile to fetch the average delay response for
   * @return The average delay response in days or null if no messages are found
   */
  async getAverageDelayResponse(userId: string): Promise<number | null> {
    // Get all conversations for the user profile
    const conversations = await this.conversationParticipantModel.findAll({
      where: { userId },
      include: [this.conversationModel],
    });

    const delays: number[] = [];

    for (const participant of conversations) {
      const conversationId = participant.conversationId;

      // Get the messages of the conversation
      const messages = await this.messageModel.findAll({
        where: { conversationId },
        order: [['createdAt', 'ASC']],
      });

      // Determine the received messages and the user replies
      for (let i = 0; i < messages.length; i++) {
        const message = messages[i];

        // If the message is not from the user profile
        if (message.authorId !== userId) {
          // Find first reply from the user after the message
          const reply = messages.find(
            (m) => m.authorId === userId && m.createdAt > message.createdAt
          );

          if (reply) {
            const delay =
              reply.createdAt.getTime() - message.createdAt.getTime();
            delays.push(delay);
          }
        }
      }
    }

    if (delays.length === 0) return null;

    const averageMs = delays.reduce((a, b) => a + b, 0) / delays.length;
    const averageDays = averageMs / (1000 * 60 * 60 * 24);

    return Math.ceil(averageDays);
  }

  /**
   * Compute the response rate for a user profile
   * Based on all the conversations where the user profile is a participant and no answer is given (excluding the conversations created within the last day)
   *
   * @param userProfileId - The ID of the user profile to fetch the response rate for
   * @return The response rate in percentage or null if no messages are found
   */
  async getResponseRate(userId: string): Promise<number | null> {
    // Get all conversations for the user profile
    const conversations = await this.conversationParticipantModel.findAll({
      where: { userId },
      include: [this.conversationModel],
    });

    const totalMessages = conversations.length;
    const answeredMessages = conversations.filter(
      (c) => c.seenAt && c.seenAt > new Date(Date.now() - 24 * 60 * 60 * 1000)
    ).length;

    if (totalMessages === 0) return null;

    return Math.round((answeredMessages / totalMessages) * 100);
  }
}
