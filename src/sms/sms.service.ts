import { Injectable, Logger } from '@nestjs/common';
import { QueuesService } from 'src/queues/producers/queues.service';
import { Jobs } from 'src/queues/queues.types';

@Injectable()
export class SmsService {
  private readonly logger = new Logger(SmsService.name);

  constructor(private readonly queuesService: QueuesService) {}

  async sendCandidateUnreadConversationSms(
    candidatePhone: string,
    coachFirstName: string,
    coachId: string
  ) {
    const conversationUrl = `${process.env.FRONT_URL}/backoffice/messaging?userId=${coachId}`;
    const text = `${coachFirstName}, Coach sur Entourage Pro, vous a envoyé un message. Lire son message : ${conversationUrl} STOP au 36111`;

    this.logger.log(
      `Queuing SMS to candidate for conversation with coach ${coachId}`
    );

    return this.queuesService.addToWorkQueue(Jobs.SEND_SMS, {
      to: candidatePhone,
      text,
    });
  }
}
