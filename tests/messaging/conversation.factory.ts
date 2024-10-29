// eslint-disable-next-line import/no-unresolved
import { faker } from '@faker-js/faker';
import { Injectable } from '@nestjs/common';
import { InjectModel } from '@nestjs/sequelize';
import { MessagingService } from 'src/messaging/messaging.service';
import { Conversation, ConversationParticipant } from 'src/messaging/models';
import { Factory } from 'src/utils/types';

@Injectable()
export class ConversationFactory implements Factory<Conversation> {
  constructor(
    @InjectModel(Conversation)
    private conversationModel: typeof Conversation,
    @InjectModel(ConversationParticipant)
    private conversationParticipantModel: typeof ConversationParticipant,
    private messagingService: MessagingService
  ) {}

  generateConversation(props: Partial<Conversation>): Partial<Conversation> {
    const fakeData: Partial<Conversation> = {};

    return {
      ...fakeData,
      ...props,
    };
  }

  async create(
    props: Partial<Conversation> = {},
    insertInDB = true
  ): Promise<Conversation> {
    const conversationData = this.generateConversation(props);
    const conversationId = faker.datatype.uuid();
    if (insertInDB) {
      await this.conversationModel.create(
        { ...conversationData, id: conversationId },
        { hooks: true }
      );
    }

    const dbConversation = await this.messagingService.findConversation(
      conversationData.id || conversationId
    );

    if (dbConversation) {
      return dbConversation.toJSON();
    }

    const builtConversation = await this.conversationModel.build(
      conversationData
    );

    const { id, ...builtConversationWithoutId } = builtConversation.toJSON();

    return {
      ...builtConversationWithoutId,
    } as Conversation;
  }
}
