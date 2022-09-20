import { Injectable } from '@nestjs/common';
import { BitlyClient } from 'bitly';
import { BitlyLink } from 'bitly/dist/types';
import { MailjetTemplateKey } from 'src/mails/mails.types';

@Injectable()
export class BitlyService {
  private shorten: (longUrl: string) => Promise<BitlyLink>;

  constructor() {
    const bitly = new BitlyClient(process.env.BITLY_TOKEN);
    this.shorten = bitly.shorten;
  }

  async getShortenedOfferURL(
    opportunityId: string,
    campaign: MailjetTemplateKey
  ) {
    try {
      const offerUrl = `${process.env.FRONT_URL}/backoffice/candidat/offres/${opportunityId}`;
      const { link } = await this.shorten(
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
