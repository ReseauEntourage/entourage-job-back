import { forwardRef, Inject, Injectable, Logger } from '@nestjs/common';
import { InjectModel } from '@nestjs/sequelize';
import { Op, Sequelize, Transaction } from 'sequelize';
import { SlackService } from 'src/external-services/slack/slack.service';
import {
  SlackBlockConfig,
  slackChannels,
} from 'src/external-services/slack/slack.types';
import { MailsService } from 'src/mails/mails.service';
import { MediasService } from 'src/medias/medias.service';
import { Media } from 'src/medias/models';
import { QueuesService } from 'src/queues/producers/queues.service';
import { Jobs } from 'src/queues/queues.types';
import { User } from 'src/users/models';
import { UsersService } from 'src/users/users.service';
import { UserRoles } from 'src/users/users.types';
import { CreateMessageDto, PostFeedbackDto } from './dto';
import { CreateMailingListDto } from './dto/create-mailing-list.dto';
import { ReportConversationDto } from './dto/report-conversation.dto';
import { userAttributes } from './messaging.attributes';
import {
  ErrorMessagingCantParticipate,
  ErrorMessagingInvalidMessage,
  ErrorMessagingMailingListInvalid,
  ErrorMessagingNeedParticipantsOrConversationId,
  ErrorMessagingReachedDailyConversationLimit,
} from './messaging.errors';
import {
  messagingConversationIncludes,
  messagingMessageIncludes,
} from './messaging.includes';
import {
  bindVariableInContent,
  determineIfShoudGiveFeedback,
  generateSlackMsgConfigConversationReported,
  generateSlackMsgConfigUserSuspiciousUser,
} from './messaging.utils';
import { ConversationParticipant, MessageMedia } from './models';
import { Conversation } from './models/conversation.model';
import { Message } from './models/message.model';

@Injectable()
export class MessagingService {
  private readonly logger = new Logger(MessagingService.name);

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
    private usersService: UsersService,
    private mailsService: MailsService,
    private mediaService: MediasService,
    private queuesService: QueuesService
  ) {}

  private readonly DAILY_CONVERSATION_LIMIT_THRESHOLD = 8;

  async createMessageWithConversation(
    createMessageDto: CreateMessageDto,
    userId: string,
    files?: Express.Multer.File[]
  ) {
    if ((!files || files.length <= 0) && createMessageDto.content.length <= 0) {
      throw new ErrorMessagingInvalidMessage(
        'Le message doit contenir au moins un caractère.'
      );
    }
    if (!createMessageDto.conversationId && !createMessageDto.participantIds) {
      throw new ErrorMessagingNeedParticipantsOrConversationId(
        'Vous devez fournir un identifiant de conversation ou une liste de participants.'
      );
    }

    // Check if user can participate
    const canParticipate = await this.canParticipate(userId, createMessageDto);
    if (!canParticipate) {
      throw new ErrorMessagingCantParticipate();
    }

    const sequelize = this.messageModel.sequelize;
    if (!sequelize) {
      throw new Error(
        'Failed to initialize database transaction in createConversationWithFirstMessage: Sequelize connection unavailable'
      );
    }
    return await sequelize.transaction(async (transaction) => {
      // Create the conversation if needed
      let conversationId = createMessageDto.conversationId;
      if (!conversationId && createMessageDto.participantIds) {
        const normalizedParticipantIds = this.normalizeParticipantIds(
          userId,
          createMessageDto.participantIds
        );

        // We always include the author in a conversation; at least 2 unique users are required.
        if (normalizedParticipantIds.length < 2) {
          throw new ErrorMessagingNeedParticipantsOrConversationId(
            'Vous devez fournir au moins un participant ou un identifiant de conversation.'
          );
        }

        const existingConversationId =
          await this.findConversationIdByExactParticipants(
            normalizedParticipantIds,
            { transaction }
          );

        if (existingConversationId) {
          conversationId = existingConversationId;
        } else {
          const conversation = await this.createConversation(
            {
              authorId: userId,
              participantIds: createMessageDto.participantIds,
              messageContent: createMessageDto.content,
            },
            { transaction }
          );
          conversationId = conversation.id;
        }
      }
      return this.createMessage(
        {
          ...createMessageDto,
          conversationId: conversationId,
          authorId: userId,
          files: files,
        },
        { transaction }
      );
    });
  }

  private normalizeParticipantIds(authorId: string, participantIds: string[]) {
    return Array.from(new Set([...(participantIds || []), authorId]))
      .filter(Boolean)
      .sort();
  }

  /**
   * Returns an existing conversation id whose participants match EXACTLY the given set.
   * Order does not matter; duplicates are ignored by the caller via normalizeParticipantIds.
   */
  private async findConversationIdByExactParticipants(
    participantIds: string[],
    options?: { transaction?: Transaction }
  ): Promise<string | null> {
    const participantCount = participantIds.length;

    // Match conversations that:
    // 1) contain all requested participants (and only them)
    // 2) have exactly participantCount participants total
    const matches = await this.conversationParticipantModel.findAll({
      attributes: ['conversationId'],
      where: {
        userId: {
          [Op.in]: participantIds,
        },
      },
      group: ['conversationId'],
      having: Sequelize.and(
        Sequelize.literal(`COUNT(DISTINCT "userId") = ${participantCount}`),
        Sequelize.literal(
          `(SELECT COUNT(DISTINCT "userId") FROM "ConversationParticipants" cp2 WHERE cp2."conversationId" = "ConversationParticipant"."conversationId") = ${participantCount}`
        )
      ),
      transaction: options?.transaction,
    });

    const firstMatch = matches?.[0];
    if (!firstMatch) {
      return null;
    }

    return firstMatch.getDataValue('conversationId') as string;
  }

  /**
   * User can participate to a conversation
   */
  private async canParticipate(
    userId: string,
    createMessageDto: CreateMessageDto
  ) {
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

        cp.conversation.messages = cp.conversation.messages.sort((a, b) => {
          return (
            new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime()
          );
        });

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
  private async createConversation(
    {
      authorId,
      participantIds,
      messageContent,
    }: { authorId: string; participantIds: string[]; messageContent?: string },
    options?: { transaction?: Transaction }
  ) {
    await this.handleDailyConversationLimit(
      authorId,
      participantIds,
      messageContent
    );

    const uniqueParticipantIds = Array.from(
      new Set([...participantIds, authorId])
    );

    const conversation = await this.conversationModel.create(
      {},
      { transaction: options?.transaction }
    );
    await this.addMembersToConversation(
      conversation.id,
      uniqueParticipantIds,
      options?.transaction
    );
    return conversation;
  }

  async setConversationHasSeen(
    conversationId: string,
    userId: string,
    transaction?: Transaction
  ) {
    const conversationParticipant =
      await this.conversationParticipantModel.findOne({
        where: {
          conversationId,
          userId,
        },
        transaction,
      });
    if (conversationParticipant) {
      conversationParticipant.seenAt = new Date();
      await conversationParticipant.save({ transaction });
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
    const reporterUser = await this.usersService.findOneWithRelations(
      reporterUserId
    );
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

  async findOneMessage(messageId: string, transaction?: Transaction) {
    const message = await this.messageModel.findByPk(messageId, {
      include: messagingMessageIncludes,
      transaction,
    });
    const medias = await this.mediaService.findMediaByMessageId(
      messageId,
      transaction
    );
    // Link medias to the message
    message.setDataValue('medias', medias);
    return message;
  }

  /**
   * Create a feedback for a conversation participant
   * @param postFeedbackDto - The feedback to create
   * @returns The updated conversation participant with the feedback
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
   * Compute the response rate for a user profile based on the ratio of conversation without response / conversation with response. A conversation with response is a conversation where a user has sent at least one message.
   * We only take into account the conversations created in the last 6 months to compute this metric but we don't take into account the conversations that are less than 3 days old because they may not have had the time to receive a response yet.
   * We also ignore the conversations that are between a user and an Admin because we consider that the user doesn't need to respond to a message from an Admin.
   * Finally, if there is no conversation that need a response (conversation with at least one message from another participant that is not an Admin), we return null because we consider that the user profile doesn't have to respond to messages if there is no message from another participant that is not an Admin. This way, a user profile that only has conversations with Admins or that only has conversations with messages from other participants but without responding messages from the user profile will have a response rate of null and not 0% which would be more penalizing.
   * @param userId - The ID of the user profile to fetch the response rate for
   * @returns The response rate in percentage or null if no conversations are found
   */
  async getResponseRate(userId: string): Promise<number | null> {
    const threeDaysAgo = new Date();
    threeDaysAgo.setDate(threeDaysAgo.getDate() - 3);

    const sixMonthAgo = new Date();
    sixMonthAgo.setMonth(sixMonthAgo.getMonth() - 6);

    // Get all conversations for the user profile created in the last 6 months and that are at least 3 days old
    const conversations = await this.conversationParticipantModel.findAll({
      where: {
        userId,
        createdAt: {
          [Op.between]: [sixMonthAgo, threeDaysAgo],
        },
      },
      include: [
        {
          model: Conversation,
          as: 'conversation',
          include: [
            {
              model: Message,
              as: 'messages',
            },
            {
              model: User,
              as: 'participants',
              attributes: ['id', 'firstName', 'lastName', 'role'],
              paranoid: false,
            },
          ],
        },
      ],
    });

    // If there is no conversation, we return null
    if (conversations.length === 0) return null;

    let conversationsWithResponse = 0;
    let conversationsToIgnore = 0;

    for (const participant of conversations) {
      const conversation = participant.conversation;
      const messages = conversation.messages;
      const participants = conversation.participants;

      // Determine if there is at least one message from another participant and at least one message from the user after a message from another participant
      const hasOneMessageFromOther = messages.some(
        (m) => m.authorId !== userId
      );

      // Determine if there is at least one message from the user
      const hasOneMessageFromUser = messages.some((m) => m.authorId === userId);

      // We ignore the conversation between a user and an Admin because we consider that the user doesn't need to respond to a message from an Admin
      const hasAdmin = participants.some(
        (p) => p.role === UserRoles.ADMIN && p.id !== userId
      );
      if (hasAdmin) {
        conversationsToIgnore++;
        continue; // If there is an Admin in the conversation, we don't consider that the conversation needs a response from the user
      }

      // If there is no message from another participant, we don't take into account the conversation in the response rate calculation because we consider that the user profile doesn't need to respond to a message if there is no message from another participant
      if (!hasOneMessageFromOther) {
        conversationsToIgnore++;
        continue; // If there is no message from another participant, we don't consider that the conversation needs a response
      }

      // If there is at least one message from another participant and at least one message from the user profile, we consider that the conversation has received a response from the user
      const hasResponse = hasOneMessageFromOther && hasOneMessageFromUser;
      if (hasResponse) {
        conversationsWithResponse++;
      }
    }

    // We calculate the response rate by dividing the number of conversations with response by the number of conversations that need a response (conversations with at least one message from another participant) and we multiply by 100 to have the rate in percentage. We ignore the conversations that are between a user and an Admin because we consider that the user doesn't need to respond to a message from an Admin.
    const validConversationsCount =
      conversations.length - conversationsToIgnore;
    if (validConversationsCount === 0) return null;
    return Math.round(
      (conversationsWithResponse / validConversationsCount) * 100
    );
  }

  /**
   * === PRIVATE METHODS ===
   */

  /**
   * Find medias linked to a conversation
   * @param conversationId
   * @returns the medias linked to the conversation
   */
  private async findMediasByConversationId(conversationId: string) {
    return this.mediaService.findMediasByConversationId(conversationId);
  }
  /**
   * Add members to a conversation
   * @param conversationId - The conversation to add members to
   * @param userIds - The users to add to the conversation
   */
  private async addMembersToConversation(
    conversationId: string,
    userIds: string[],
    transaction?: Transaction
  ) {
    await this.conversationParticipantModel.bulkCreate(
      userIds.map((userId) => ({
        conversationId,
        userId,
      })),
      { transaction }
    );
  }

  /**
   * Create a new message
   * @param message - The message to create
   */
  private async createMessage(
    createMessageDto: Partial<
      Message & {
        files: Express.Multer.File[];
        mediaIds?: string[];
      }
    >,
    options?: { transaction?: Transaction }
  ) {
    const transaction = options?.transaction;
    if (createMessageDto.files) {
      const mediaRecords = await this.mediaService.bulkUploadAndCreateMedias(
        createMessageDto.files,
        createMessageDto.authorId
      );
      createMessageDto.mediaIds = mediaRecords.map((media: Media) => media.id);
    }
    const createdMessage = await this.messageModel.create(createMessageDto, {
      transaction,
    });
    if (createMessageDto.mediaIds && createMessageDto.mediaIds.length > 0) {
      await this.addMediasToMessage(
        createdMessage.id,
        createMessageDto.mediaIds,
        transaction
      );
    }
    // Set conversation as seen because the user has sent a message
    await this.setConversationHasSeen(
      createMessageDto.conversationId,
      createMessageDto.authorId,
      transaction
    );
    const message = await this.findOneMessage(createdMessage.id, transaction);

    const notifyOtherParticipants = () => {
      const otherParticipants = message.conversation.participants.filter(
        (participant) => participant.id !== createMessageDto.authorId
      );
      this.mailsService.sendNewMessageNotifMail(message, otherParticipants);
    };

    if (transaction) {
      transaction.afterCommit(() => {
        notifyOtherParticipants();
      });
    } else {
      notifyOtherParticipants();
    }

    return message;
  }

  private async addMediasToMessage(
    messageId: string,
    mediasId: string[],
    transaction?: Transaction
  ) {
    if (mediasId.length === 0) {
      return;
    }
    await this.messageMediaModel.bulkCreate(
      mediasId.map((mediaId) => ({
        messageId,
        mediaId,
      })),
      { transaction }
    );
  }

  private async handleDailyConversationLimit(
    senderId: string,
    participantIds: string[],
    message?: string
  ) {
    const sender = await this.usersService.findOneWithRelations(senderId);
    if (sender.role === UserRoles.ADMIN) {
      // Admins can create as many conversations as they want
      return;
    }
    const countDailyConversation = await this.countDailyConversations(
      sender.id
    );
    if (countDailyConversation >= this.DAILY_CONVERSATION_LIMIT_THRESHOLD - 1) {
      const recipients: User[] = [];
      for (const id of participantIds) {
        const recipient = await this.usersService.findOneWithRelations(id);
        if (recipient) {
          recipients.push(recipient);
        }
      }

      const moderatorSlackEmail = sender.staffContact?.slackEmail;
      const referentSlackUserId = await this.slackService.getUserIdByEmail(
        moderatorSlackEmail
      );
      const slackMsgConfig: SlackBlockConfig =
        generateSlackMsgConfigUserSuspiciousUser(
          sender,
          recipients,
          `Un utilisateur tente de créer sa ${
            countDailyConversation + 1
          }ème conversation aujourd\'hui`,
          referentSlackUserId,
          message || 'Aucun message fourni'
        );
      const slackMessage =
        this.slackService.generateSlackBlockMsg(slackMsgConfig);
      this.slackService.sendMessage(
        slackChannels.ENTOURAGE_PRO_MODERATION,
        slackMessage,
        'Conversation de la messagerie signalée'
      );

      throw new ErrorMessagingReachedDailyConversationLimit();
    }
  }

  /**
   * Count the number of conversations created by a user that day
   * @param userId - The ID of the user to count the conversations for
   * @returns The number of conversations created by the user that day
   */
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

  async createMailingList(createMailingListDto: CreateMailingListDto) {
    const { recipientEmails, content } = createMailingListDto;
    // Check if emails exists in the database and get the corresponding users
    const users = await this.usersService.findByEmailsWithRelations(
      recipientEmails
    );
    const existingEmails = users.map((user) => user.email);
    const nonExistingEmails = recipientEmails.filter(
      (email) => !existingEmails.includes(email)
    );
    if (nonExistingEmails.length > 0) {
      throw new ErrorMessagingMailingListInvalid(
        `Les emails suivants n'existent pas dans la base de données: ${nonExistingEmails.join(
          ', '
        )}`
      );
    }
    // Check all users are CANDIDATE or COACH role
    const invalidRoleUsers = users.filter(
      (user) =>
        user.role !== UserRoles.CANDIDATE && user.role !== UserRoles.COACH
    );
    if (invalidRoleUsers.length > 0) {
      throw new ErrorMessagingMailingListInvalid(
        `Les utilisateurs suivants n'ont pas un rôle valide (CANDIDATE ou COACH): ${invalidRoleUsers
          .map((user) => user.email)
          .join(', ')}`
      );
    }

    const messages = recipientEmails.map((email) => {
      const user = users.find((u) => u.email === email);
      return {
        addresseeEmail: email,
        message: bindVariableInContent(content, {
          email: email,
          firstName: user?.firstName || '',
          lastName: user?.lastName || '',
          staffContactName: user?.staffContact?.name || '',
        }),
      };
    });

    await this.queuesService.addToWorkQueue(
      Jobs.BULK_SEND_STAFF_MESSAGING_MESSAGE,
      {
        messages,
      }
    );
  }
}
