import { Injectable, Logger } from '@nestjs/common';
import { ShortioService } from 'src/external-services/shortio/shortio.service';
import { QueuesService } from 'src/queues/producers/queues.service';
import { Jobs } from 'src/queues/queues.types';
import { tracer } from 'src/tracer';
import { NormalUserRole, UserRoles } from 'src/users/users.types';

const SENDER_ROLE_BY_RECIPIENT: Record<NormalUserRole, NormalUserRole> = {
  [UserRoles.CANDIDATE]: UserRoles.COACH,
  [UserRoles.COACH]: UserRoles.CANDIDATE,
};

const METRIC_ROLE_TAG: Record<NormalUserRole, string> = {
  [UserRoles.CANDIDATE]: 'candidate',
  [UserRoles.COACH]: 'coach',
};

@Injectable()
export class SmsService {
  private readonly logger = new Logger(SmsService.name);

  constructor(
    private readonly queuesService: QueuesService,
    private readonly shortioService: ShortioService
  ) {}

  async sendUnansweredConversationSms(
    recipientPhone: string,
    recipientRole: NormalUserRole,
    senderFirstName: string,
    senderId: string
  ) {
    const senderRole = SENDER_ROLE_BY_RECIPIENT[recipientRole];
    const conversationUrl = `${process.env.FRONT_URL}/backoffice/messaging?userId=${senderId}`;
    const shortUrl = await this.shortioService.shortenUrl(conversationUrl);
    const text = `${senderFirstName}, ${senderRole} sur Entourage Pro, vous a envoyé un message. Répondre à son message : ${shortUrl}`;

    this.logger.log('Shortened conversation URL for SMS: ' + shortUrl);
    this.logger.log(
      `Queuing unanswered conversation reminder SMS to ${recipientRole} for conversation with ${senderRole} ${senderId}`
    );

    const result = await this.queuesService.addToWorkQueue(Jobs.SEND_SMS, {
      to: recipientPhone,
      text,
    });

    tracer.dogstatsd.increment('sms.reminder.sent', 1, {
      role: METRIC_ROLE_TAG[recipientRole],
    });

    return result;
  }
}
