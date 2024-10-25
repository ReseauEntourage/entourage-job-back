// eslint-disable-next-line import/no-unresolved
import { faker } from '@faker-js/faker';
import { Injectable } from '@nestjs/common';
import { InjectModel } from '@nestjs/sequelize';
import { MessagingService } from 'src/messaging/messaging.service';
import { ConversationParticipant } from 'src/messaging/models';
import { Factory } from 'src/utils/types';

@Injectable()
export class ConversationFactory implements Factory<ConversationParticipant> {
  constructor(
    @InjectModel(ConversationParticipant)
    private conversationParticipantModel: typeof ConversationParticipant,
    private messagingService: MessagingService
  ) {}

  generateConversationParticipant(
    props: Partial<ConversationParticipant>
  ): Partial<ConversationParticipant> {
    const fakeData: Partial<ConversationParticipant> = {};

    return {
      ...fakeData,
      ...props,
    };
  }

  async create(
    props: Partial<ConversationParticipant> = {},
    insertInDB = true
  ): Promise<ConversationParticipant> {
    const conversationParticipantData =
      this.generateConversationParticipant(props);

    const conversationId = faker.datatype.uuid();

    if (insertInDB) {
      await this.conversationParticipantModel.create(
        { ...conversationParticipantData, id: conversationId },
        { hooks: true }
      );
    }

    const dbConversation = await this.messagingService.findConversation(
      conversationParticipantData.id || conversationId
    );

    if (dbConversation) {
      return dbConversation.toJSON();
    }

    const builtConversation = await this.conversationParticipantModel.build(
      conversationParticipantData
    );

    const { id, ...builtConversationWithoutId } = builtConversation.toJSON();

    return {
      ...builtConversationWithoutId,
    } as ConversationParticipant;
  }
}
