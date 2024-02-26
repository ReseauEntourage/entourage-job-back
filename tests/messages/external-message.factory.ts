// eslint-disable-next-line import/no-unresolved
import faker from '@faker-js/faker';
import { Injectable } from '@nestjs/common';
import { InjectModel } from '@nestjs/sequelize';
import phone from 'phone';
import { MessagesService } from 'src/messages/messages.service';
import {
  ExternalMessageContactTypeFilters,
  ExternalMessageSubjectFilters,
} from 'src/messages/messages.types';
import { ExternalMessage } from 'src/messages/models';
import { Factory } from 'src/utils/types';

@Injectable()
export class ExternalMessageFactory implements Factory<ExternalMessage> {
  constructor(
    @InjectModel(ExternalMessage)
    private messageModel: typeof ExternalMessage,
    private messagesService: MessagesService
  ) {}

  generateExternalMessage(
    props: Partial<ExternalMessage>
  ): Partial<ExternalMessage> {
    const fakePhoneNumber = faker.phone.phoneNumber('+336 ## ## ## ##');

    const fakeData: Partial<ExternalMessage> = {
      senderFirstName: faker.name.firstName(),
      senderLastName: faker.name.lastName(),
      senderEmail: faker.internet.email(),
      senderPhone: phone(fakePhoneNumber, { country: 'FRA' }).phoneNumber,
      subject: faker.random.arrayElement(
        ExternalMessageSubjectFilters.map(({ value }) => value)
      ),
      optInNewsletter: faker.datatype.boolean(),
      message: faker.lorem.lines(3),
      type: faker.random.arrayElement(
        ExternalMessageContactTypeFilters.map(({ value }) => value)
      ),
    };

    return {
      ...fakeData,
      ...props,
    };
  }

  async create(
    props: Partial<ExternalMessage> = {},
    insertInDB = true
  ): Promise<ExternalMessage> {
    const messageData = this.generateExternalMessage(props);

    const messageId = faker.datatype.uuid();
    if (insertInDB) {
      await this.messageModel.create(
        { ...messageData, id: messageId },
        { hooks: true }
      );
    }
    const dbMessage = await this.messagesService.findOneExternalMessage(
      messageData.id || messageId
    );
    if (dbMessage) {
      return dbMessage.toJSON();
    }
    const builtMessage = await this.messageModel.build(messageData);

    const { id, ...builtMessageWithoutId } = builtMessage.toJSON();

    return {
      ...builtMessageWithoutId,
    } as ExternalMessage;
  }
}
