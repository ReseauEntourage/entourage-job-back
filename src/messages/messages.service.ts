import { Injectable } from '@nestjs/common';
import { InjectModel } from '@nestjs/sequelize';
import { ExternalDatabasesService } from 'src/external-databases/external-databases.service';
import { SlackService } from 'src/external-services/slack/slack.service';
import { slackChannels } from 'src/external-services/slack/slack.types';
import { MailsService } from 'src/mails/mails.service';
import { User } from 'src/users/models';
import { UsersService } from 'src/users/users.service';
import { forbiddenExpressionsInMessage } from './messages.utils';
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
    return this.slackService.sendMessage(
      slackChannels.ENTOURAGE_PRO_MODERATION,
      [
        {
          type: 'section',
          text: {
            type: 'plain_text',
            emoji: true,
            text: 'Message suspect détecté sur Entourage-Pro',
          },
        },
        {
          type: 'section',
          text: {
            type: 'plain_text',
            text: `Environnement: ${process.env.NODE_ENV}`,
          },
        },
        {
          type: 'divider',
        },
        {
          type: 'section',
          text: {
            type: 'mrkdwn',
            text: `*Expéditeur*\n${senderUser.email}`,
          },
        },
        {
          type: 'divider',
        },
        {
          type: 'section',
          text: {
            type: 'mrkdwn',
            text: `*Destinataire*\n${addresseeUser.email}`,
          },
        },
        {
          type: 'divider',
        },
        {
          type: 'context',
          elements: [
            {
              type: 'image',
              image_url:
                'https://api.slack.com/img/blocks/bkb_template_images/notificationsWarningIcon.png',
              alt_text: 'warning icon',
            },
            {
              type: 'mrkdwn',
              text: "*Le message n'a pas été envoyé à son destinataire car il contenait des mots interdits*",
            },
            {
              type: 'mrkdwn',
              text:
                '*Mots interdits :* ' + forbiddenExpressionsFound.join(', '),
            },
          ],
        },
        {
          type: 'section',
          text: {
            type: 'mrkdwn',
            text: `*Objet : ${message.subject}*`,
          },
        },
        {
          type: 'section',
          text: {
            type: 'mrkdwn',
            text: message.message,
          },
        },
      ],
      'Message suspect détecté (InternalMessage : ' + message.id + ')'
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
