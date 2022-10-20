import { InjectQueue } from '@nestjs/bull';
import { Injectable } from '@nestjs/common';
import { Queue } from 'bull';
import * as _ from 'lodash';
import { BitlyService } from 'src/external-services/bitly/bitly.service';
import {
  MailjetTemplateKey,
  MailjetTemplates,
} from 'src/external-services/mailjet/mailjet.types';
import { Jobs, Queues } from 'src/queues/queues.types';
import { isValidPhone } from 'src/utils/misc';

@Injectable()
export class SMSService {
  constructor(
    @InjectQueue(Queues.WORK)
    private workQueue: Queue,
    private bitlyService: BitlyService
  ) {}

  async sendCandidateOfferSMS(candidatePhone: string, opportunityId: string) {
    if (candidatePhone && isValidPhone(candidatePhone)) {
      await this.workQueue.add(Jobs.SEND_SMS, {
        toPhone: candidatePhone,
        text: `Bonjour,\nUn recruteur vous a personnellement adressé une offre sur LinkedOut. Consultez-la ici et traitez-la avec votre coach: ${await this.bitlyService.getShortenedOfferURL(
          opportunityId,
          _.findKey(MailjetTemplates, (id) => {
            return id === MailjetTemplates.OFFER_RECEIVED;
          }) as MailjetTemplateKey
        )}`,
      });
    }
  }

  async sendReminderAboutOfferSMS(
    candidatePhone: string,
    opportunityId: string
  ) {
    if (candidatePhone && isValidPhone(candidatePhone)) {
      await this.workQueue.add(Jobs.SEND_SMS, {
        toPhone: candidatePhone,
        text: `Bonjour,\nIl y a 5 jours un recruteur vous a personnellement adressé une offre. Consultez-la ici et traitez-la avec votre coach: ${await this.bitlyService.getShortenedOfferURL(
          opportunityId,
          _.findKey(MailjetTemplates, (id) => {
            return id === MailjetTemplates.OFFER_REMINDER;
          }) as MailjetTemplateKey
        )}`,
      });
    }
  }
}
