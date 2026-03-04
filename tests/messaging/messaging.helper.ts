// eslint-disable-next-line import/no-unresolved
import { faker } from '@faker-js/faker';
import { Injectable } from '@nestjs/common';
import { InjectModel } from '@nestjs/sequelize';
import {
  Conversation,
  ConversationParticipant,
  Message,
} from 'src/messaging/models';
import { User } from 'src/users/models';

@Injectable()
export class MessagingHelper {
  constructor(
    @InjectModel(Message)
    private messageModel: typeof Message,
    @InjectModel(Conversation)
    private conversationModel: typeof Conversation,
    @InjectModel(ConversationParticipant)
    private conversationParticipantModel: typeof ConversationParticipant
  ) {}

  async associationParticipantsToConversation(
    conversationId: string,
    userIds: string[]
  ) {
    return this.conversationParticipantModel.bulkCreate(
      userIds.map((userId) => ({
        conversationId,
        userId,
      }))
    );
  }

  async addMessagesToConversation(
    count: number,
    conversationId: string,
    authorId: string,
    props: Partial<Message> = {}
  ) {
    const messages = Array.from({ length: count }, () => {
      const messageData = {
        content: faker.lorem.sentence(),
        conversationId,
        authorId,
        ...props,
      };

      return messageData;
    });

    return this.messageModel.bulkCreate(messages);
  }

  async createMessage(
    conversationId: string,
    authorId: string,
    props: Partial<Message> = {}
  ) {
    return this.messageModel.create({
      content: faker.lorem.sentence(),
      conversationId,
      authorId,
      ...props,
    });
  }

  async countConversation() {
    return this.conversationModel.count();
  }

  async findConversation(conversationId: string) {
    return this.conversationModel.findByPk(conversationId, {
      include: [
        {
          model: Message,
          as: 'messages',
          attributes: ['id', 'content', 'createdAt', 'authorId'],
        },
        {
          model: User,
          as: 'participants',
          attributes: ['id', 'firstName', 'lastName'],
        },
      ],
    });
  }
}
