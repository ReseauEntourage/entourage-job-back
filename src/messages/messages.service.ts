import { Injectable } from '@nestjs/common';
import { InjectModel } from '@nestjs/sequelize';
import { ExternalDatabasesService } from 'src/external-databases/external-databases.service';
import { MailsService } from 'src/mails/mails.service';
import { User } from 'src/users/models';
import { UsersService } from 'src/users/users.service';
import { ExternalMessage, InternalMessage } from './models';

@Injectable()
export class MessagesService {
  constructor(
    @InjectModel(ExternalMessage)
    private externalMessageModel: typeof ExternalMessage,
    @InjectModel(InternalMessage)
    private internalMessageModel: typeof InternalMessage,
    private mailsService: MailsService,
    private usersService: UsersService,
    private externalDatabasesService: ExternalDatabasesService
  ) {}

  async createExternalMessage(createMessageDto: Partial<ExternalMessage>) {
    return this.externalMessageModel.create(createMessageDto, {
      hooks: true,
    });
  }

  async createInternalMessage(createMessageDto: Partial<InternalMessage>) {
    return this.internalMessageModel.create(createMessageDto, {
      hooks: true,
    });
  }

  async findOneExternalMessage(id: string) {
    return this.externalMessageModel.findByPk(id, {
      include: [
        {
          model: User,
          as: 'user',
          attributes: ['firstName', 'lastName', 'email', 'zone'],
        },
      ],
    });
  }

  async findOneInternalMessage(id: string) {
    return this.internalMessageModel.findByPk(id, {});
  }

  async findOneUser(id: string) {
    return this.usersService.findOne(id);
  }

  async sendExternalMessageReceivedMail(
    candidate: User,
    message: ExternalMessage,
    isHiringOffer: boolean
  ) {
    return this.mailsService.sendExternalMessageReceivedMail(
      candidate,
      message,
      isHiringOffer
    );
  }

  async sendInternalMessageByMail(
    senderUser: User,
    addresseeUser: User,
    message: InternalMessage
  ) {
    return this.mailsService.sendInternalMessageByMail(
      senderUser,
      addresseeUser,
      message
    );
  }

  async createOrUpdateExternalDBTask(externalMessageId: string) {
    return this.externalDatabasesService.createOrUpdateExternalDBTask(
      externalMessageId
    );
  }

  async getLastMessageBetweenUsers(
    senderUserId: string,
    addresseeUserId: string
  ) {
    return await this.internalMessageModel.findOne({
      where: {
        senderUserId,
        addresseeUserId,
      },
      order: [['createdAt', 'DESC']],
    });
  }
}
