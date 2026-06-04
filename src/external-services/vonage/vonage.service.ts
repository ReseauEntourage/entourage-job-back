import { Injectable, Logger } from '@nestjs/common';
import { Channels } from '@vonage/messages';
import { Vonage } from '@vonage/server-sdk';

@Injectable()
export class VonageService {
  private readonly logger = new Logger(VonageService.name);
  private readonly vonage: Vonage;
  private readonly FROM_NUMBER = 'Entourage';

  constructor() {
    if (!process.env.VONAGE_API_KEY || !process.env.VONAGE_API_SECRET) {
      throw new Error('Vonage API credentials are not set');
    }
    this.vonage = new Vonage({
      apiKey: process.env.VONAGE_API_KEY,
      apiSecret: process.env.VONAGE_API_SECRET,
    });
  }

  async sendSms(to: string, text: string): Promise<void> {
    const normalizedTo = to.replace(/\s+/g, '').replace(/^\+/, '');

    this.logger.log(`Sending SMS to ${normalizedTo}`);

    try {
      const { messageUUID } = await this.vonage.messages.send({
        messageType: 'text',
        channel: Channels.SMS,
        text,
        to: normalizedTo,
        from: this.FROM_NUMBER,
      });

      this.logger.log(
        `SMS sent successfully to ${normalizedTo} (uuid: ${messageUUID})`
      );
    } catch (error) {
      this.logger.error(`Failed to send SMS to ${normalizedTo}`, error);
      throw error;
    }
  }
}
