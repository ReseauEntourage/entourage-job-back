import { Injectable } from '@nestjs/common';
import { InjectModel } from '@nestjs/sequelize';
import { SalesforceService } from 'src/external-services/salesforce/salesforce.service';
import { MailsService } from 'src/mails/mails.service';
import { User } from 'src/users/models';
import { UsersService } from 'src/users/users.service';
import { Message } from './models';

@Injectable()
export class MessagesService {
  constructor(
    @InjectModel(Message)
    private messageModel: typeof Message,
    private mailsService: MailsService,
    private usersService: UsersService,
    private salesforceService: SalesforceService
  ) {}

  async create(createMessageDto: Partial<Message>) {
    return this.messageModel.create(createMessageDto, {
      hooks: true,
    });
  }

  async findOne(id: string) {
    return this.messageModel.findByPk(id);
  }

  async findOneUser(id: string) {
    return this.usersService.findOne(id);
  }

  async sendMessageMail(candidate: User, message: Message) {
    return this.mailsService.sendMessageMail(candidate, message);
  }

  async sendMessageToSalesforce(/* candidate: User, message: Message */) {
    // TODO LATER
  }
}
