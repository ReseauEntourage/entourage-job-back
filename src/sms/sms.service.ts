import { Injectable } from '@nestjs/common';
import * as _ from 'lodash';
import { BitlyService } from 'src/external-services/bitly/bitly.service';
import {
  MailjetTemplateKey,
  MailjetTemplates,
} from 'src/external-services/mailjet/mailjet.types';
import { QueuesService } from 'src/queues/producers/queues.service';
import { Jobs } from 'src/queues/queues.types';
import { isValidPhone } from 'src/utils/misc';

@Injectable()
export class SMSService {
  constructor(
    private queuesService: QueuesService,
    private bitlyService: BitlyService
  ) {}

  async sendCandidateOfferSMS(
    candidateId: string,
    candidatePhone: string,
    opportunityId: string
  ) {
    if (candidatePhone && isValidPhone(candidatePhone)) {
      await this.queuesService.addToWorkQueue(Jobs.SEND_SMS, {
        toPhone: candidatePhone,
        text: `Bonjour,\nUn recruteur vous a personnellement adressé une offre sur Entourage Pro. Consultez-la ici et traitez-la avec votre coach: ${await this.bitlyService.getShortenedOfferURL(
          candidateId,
          opportunityId,
          _.findKey(MailjetTemplates, (id) => {
            return id === MailjetTemplates.OFFER_RECEIVED;
          }) as MailjetTemplateKey
        )}`,
      });
    }
  }

  async sendReminderAboutOfferSMS(
    candidateId: string,
    candidatePhone: string,
    opportunityId: string
  ) {
    if (candidatePhone && isValidPhone(candidatePhone)) {
      await this.queuesService.addToWorkQueue(Jobs.SEND_SMS, {
        toPhone: candidatePhone,
        text: `Bonjour,\nIl y a 5 jours un recruteur vous a personnellement adressé une offre sur Entourage Pro. Consultez-la ici et traitez-la avec votre coach: ${await this.bitlyService.getShortenedOfferURL(
          candidateId,
          opportunityId,
          _.findKey(MailjetTemplates, (id) => {
            return id === MailjetTemplates.OFFER_REMINDER;
          }) as MailjetTemplateKey
        )}`,
      });
    }
  }
}
