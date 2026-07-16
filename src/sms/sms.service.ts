import { Injectable, Logger } from '@nestjs/common';
import { ShortioService } from 'src/external-services/shortio/shortio.service';
import { QueuesService } from 'src/queues/producers/queues.service';
import { Jobs } from 'src/queues/queues.types';

@Injectable()
export class SmsService {
  private readonly logger = new Logger(SmsService.name);

  constructor(
    private readonly queuesService: QueuesService,
    private readonly shortioService: ShortioService
  ) {}

  async sendCandidateUnansweredConversationSms(
    candidatePhone: string,
    coachFirstName: string,
    coachId: string
  ) {
    const conversationUrl = `${process.env.FRONT_URL}/backoffice/messaging?userId=${coachId}`;
    const shortUrl = await this.shortioService.shortenUrl(conversationUrl);
    const text = `${coachFirstName}, Coach sur Entourage Pro, vous a envoyé un message. Répondre à son message : ${shortUrl}`;

    this.logger.log('Shortened conversation URL for SMS: ' + shortUrl);
    this.logger.log(
      `Queuing SMS to candidate for conversation with coach ${coachId}`
    );

    return this.queuesService.addToWorkQueue(Jobs.SEND_SMS, {
      to: candidatePhone,
      text,
    });
  }
}
