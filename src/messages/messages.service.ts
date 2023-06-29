import { Injectable } from '@nestjs/common';
import { InjectModel } from '@nestjs/sequelize';
import { User } from '../users/models';
import { MailsService } from 'src/mails/mails.service';
import { UsersService } from 'src/users/users.service';
import { Message } from './models';

@Injectable()
export class MessagesService {
  constructor(
    @InjectModel(Message)
    private messageModel: typeof Message,
    private mailsService: MailsService,
    private usersService: UsersService
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
}
