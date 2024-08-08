import { Injectable } from '@nestjs/common';
import { InjectModel } from '@nestjs/sequelize';
import { ExternalDatabasesService } from 'src/external-databases/external-databases.service';
import { SlackBlockBuilderService } from 'src/external-services/slack/slack-block-builder.service';
import { SlackService } from 'src/external-services/slack/slack.service';
import { slackChannels } from 'src/external-services/slack/slack.types';
import { MailsService } from 'src/mails/mails.service';
import { User } from 'src/users/models';
import { UsersService } from 'src/users/users.service';
import {
  forbiddenExpressionsInMessage,
  generateSlackMsgConfigMessageResent,
  generateSlackMsgConfigSuspiciousMessageDetected,
} from './messages.utils';
import { ExternalMessage, InternalMessage } from './models';

@Injectable()
export class MessagesService {
  constructor(
    @InjectModel(ExternalMessage)
    private externalMessageModel: typeof ExternalMessage,
    @InjectModel(InternalMessage)
    private internalMessageModel: typeof InternalMessage,
    private mailsService: MailsService,
    private slackService: SlackService,
    private usersService: UsersService,
    private externalDatabasesService: ExternalDatabasesService,
    private slackBlockBuilderService: SlackBlockBuilderService
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
    message: InternalMessage,
    checkForbiddenExpressions = true
  ) {
    if (checkForbiddenExpressions) {
      const forbiddenExpressionsFound = forbiddenExpressionsInMessage(
        message.message
      );
      if (forbiddenExpressionsFound.length > 0) {
        return this.sendSuspiciousMessageSlackNotification(
          senderUser,
          addresseeUser,
          message,
          forbiddenExpressionsFound
        );
      }
    }
    return this.mailsService.sendInternalMessageByMail(
      senderUser,
      addresseeUser,
      message
    );
  }

  async sendSuspiciousMessageSlackNotification(
    senderUser: User,
    addresseeUser: User,
    message: InternalMessage,
    forbiddenExpressionsFound: string[]
  ) {
    const slackMsgConfig = generateSlackMsgConfigSuspiciousMessageDetected(
      message,
      senderUser,
      addresseeUser,
      forbiddenExpressionsFound
    );
    const slackBlocks =
      this.slackBlockBuilderService.generateSlackBlockMsg(slackMsgConfig);
    return this.slackService.sendMessage(
      slackChannels.ENTOURAGE_PRO_MODERATION,
      slackBlocks,
      'Message suspect détecté (InternalMessage : ' + message.id + ')'
    );
  }

  async sendInternalMessageResendSlackNotification(
    internalMessage: InternalMessage,
    adminUser: User,
    senderUser: User,
    addresseeUser: User
  ) {
    const slackMsgConfig = generateSlackMsgConfigMessageResent(
      internalMessage,
      adminUser,
      senderUser,
      addresseeUser
    );
    const slackBlocks =
      this.slackBlockBuilderService.generateSlackBlockMsg(slackMsgConfig);
    return this.slackService.sendMessage(
      slackChannels.ENTOURAGE_PRO_MODERATION,
      slackBlocks,
      `Le message interne ${internalMessage.id} a été renvoyé par un administrateur`
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
