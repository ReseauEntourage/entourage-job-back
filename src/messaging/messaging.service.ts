import {
  BadRequestException,
  HttpException,
  HttpStatus,
  Injectable,
  UnauthorizedException,
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
import { User } from 'src/users/models';
import { UsersService } from 'src/users/users.service';
import { UserRoles } from 'src/users/users.types';
import { CreateMessageDto } from './dto';
import { ReportConversationDto } from './dto/report-conversation.dto';
import { userAttributes } from './messaging.attributes';
import {
  messagingConversationIncludes,
  messagingMessageIncludes,
} from './messaging.includes';
import {
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
      throw new UnauthorizedException(
        'Vous ne faites pas partie de cette conversation.'
      );
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
      .filter((cp) => cp.conversation)
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
      createMessageDto.mediaIds = mediaRecords.map((media) => media.id);
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

    const conversationMedias = await this.findMediasByConversationId(
      conversationId
    );

    conversation.messages.forEach((message) => {
      const messageMedias = conversationMedias.filter((media) =>
        message.medias.map((m) => m.id).includes(media.id)
      );
      message.setDataValue('medias', messageMedias);
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

  /////////////////////
  // Private methods //
  /////////////////////

  private async isUserInConversation(conversationId: string, userId: string) {
    return this.conversationParticipantModel.findOne({
      where: {
        conversationId,
        userId,
      },
    });
  }
}
