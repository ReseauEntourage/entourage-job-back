import { Injectable } from '@nestjs/common';
import { BitlyClient } from 'bitly';
import { MailjetTemplateKey } from 'src/external-services/mailjet/mailjet.types';

@Injectable()
export class BitlyService {
  private bitly: BitlyClient;

  constructor() {
    this.bitly = new BitlyClient(process.env.BITLY_TOKEN);
  }

  async getShortenedOfferURL(
    opportunityId: string,
    campaign: MailjetTemplateKey
  ) {
    try {
      const offerUrl = `${process.env.FRONT_URL}/backoffice/candidat/offres/private/${opportunityId}`;
      const { link } = await this.bitly.shorten(
        `${offerUrl.replace('localhost', '127.0.0.1')}${
          campaign
            ? `?utm_source=SMS&utm_medium=SMS&utm_campaign=${campaign}`
            : ''
        }`
      );
      return link;
    } catch (err) {
      console.error(err);
      return `${process.env.FRONT_URL}/login`;
    }
  }
}
