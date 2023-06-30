// eslint-disable-next-line import/no-unresolved
import faker from '@faker-js/faker';
import { Injectable } from '@nestjs/common';
import { InjectModel } from '@nestjs/sequelize';
import phone from 'phone';
import { MessagesService } from 'src/messages/messages.service';
import {
  MessageSubjectFilters,
  MessageContactTypeFilters,
} from 'src/messages/messages.types';
import { Message } from 'src/messages/models';
import { Factory } from 'src/utils/types';

@Injectable()
export class MessageFactory implements Factory<Message> {
  constructor(
    @InjectModel(Message)
    private messageModel: typeof Message,
    private messagesService: MessagesService
  ) {}

  generateMessage(props: Partial<Message>): Partial<Message> {
    const fakePhoneNumber = faker.phone.phoneNumber('+336 ## ## ## ##');

    const fakeData: Partial<Message> = {
      firstName: faker.name.firstName(),
      lastName: faker.name.lastName(),
      email: faker.internet.email(),
      phone: phone(fakePhoneNumber, { country: 'FRA' }).phoneNumber,
      subject: faker.random.arrayElement(
        MessageSubjectFilters.map(({ value }) => value)
      ),
      message: faker.lorem.lines(3),
      type: faker.random.arrayElement(
        MessageContactTypeFilters.map(({ value }) => value)
      ),
    };

    return {
      ...fakeData,
      ...props,
    };
  }

  async create(
    props: Partial<Message> = {},
    insertInDB = true
  ): Promise<Message> {
    const messageData = this.generateMessage(props);

    const messageId = faker.datatype.uuid();
    if (insertInDB) {
      await this.messageModel.create(
        { ...messageData, id: messageId },
        { hooks: true }
      );
    }
    const dbMessage = await this.messagesService.findOne(
      messageData.id || messageId
    );
    if (dbMessage) {
      return dbMessage.toJSON();
    }
    const builtMessage = await this.messageModel.build(messageData);

    const { id, ...builtMessageWithoutId } = builtMessage.toJSON();

    return {
      ...builtMessageWithoutId,
    } as Message;
  }
}
