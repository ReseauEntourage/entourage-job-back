import { Injectable } from '@nestjs/common';
import { InjectModel } from '@nestjs/sequelize';
import { ExternalDatabasesService } from 'src/external-databases/external-databases.service';
import { MailsService } from 'src/mails/mails.service';
import { User } from 'src/users/models';
import { UsersService } from 'src/users/users.service';
import { ExternalMessage } from './models';

@Injectable()
export class ExternalMessagesService {
  constructor(
    @InjectModel(ExternalMessage)
    private messageModel: typeof ExternalMessage,
    private mailsService: MailsService,
    private usersService: UsersService,
    private externalDatabasesService: ExternalDatabasesService
  ) {}

  async create(createMessageDto: Partial<ExternalMessage>) {
    return this.messageModel.create(createMessageDto, {
      hooks: true,
    });
  }

  async findOne(id: string) {
    return this.messageModel.findByPk(id, {
      include: [
        {
          model: User,
          as: 'user',
          attributes: ['firstName', 'lastName', 'email', 'zone'],
        },
      ],
    });
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

  async createOrUpdateExternalDBTask(externalMessageId: string) {
    return this.externalDatabasesService.createOrUpdateExternalDBTask(
      externalMessageId
    );
  }
}
