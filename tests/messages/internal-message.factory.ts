// eslint-disable-next-line import/no-unresolved
import { faker } from '@faker-js/faker';
import { Injectable } from '@nestjs/common';
import { InjectModel } from '@nestjs/sequelize';
import { MessagesService } from 'src/messages/messages.service';
import { InternalMessage } from 'src/messages/models';
import { Factory } from 'src/utils/types';

@Injectable()
export class InternalMessageFactory implements Factory<InternalMessage> {
  constructor(
    @InjectModel(InternalMessage)
    private messageModel: typeof InternalMessage,
    private messagesService: MessagesService
  ) {}

  generateInternalMessage(
    props: Partial<InternalMessage>
  ): Partial<InternalMessage> {
    const fakeData: Partial<InternalMessage> = {
      subject: faker.lorem.lines(1),
      message: faker.lorem.lines(3),
    };

    return {
      ...fakeData,
      ...props,
    };
  }

  async create(
    props: Partial<InternalMessage> = {},
    insertInDB = true
  ): Promise<InternalMessage> {
    const messageData = this.generateInternalMessage(props);

    const messageId = faker.datatype.uuid();

    if (insertInDB) {
      await this.messageModel.create(
        { ...messageData, id: messageId },
        { hooks: true }
      );
    }

    const dbMessage = await this.messagesService.findOneInternalMessage(
      messageData.id || messageId
    );

    if (dbMessage) {
      return dbMessage.toJSON();
    }

    const builtMessage = await this.messageModel.build(messageData);

    const { id, ...builtMessageWithoutId } = builtMessage.toJSON();

    return {
      ...builtMessageWithoutId,
    } as InternalMessage;
  }
}
