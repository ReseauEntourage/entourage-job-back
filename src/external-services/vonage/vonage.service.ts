import { Injectable } from '@nestjs/common';
import Vonage from '@vonage/server-sdk';
import { CustomSMSParams } from './vonage.types';

@Injectable()
export class VonageService {
  private vonage: Vonage;

  constructor() {
    this.vonage = new Vonage({
      apiKey: process.env.VONAGE_API_KEY,
      apiSecret: process.env.VONAGE_API_SECRET,
    });
  }

  createSMS({ toPhone, text }: CustomSMSParams) {
    if (typeof toPhone === 'string') {
      return [{ toPhone, text }];
    } else if (Array.isArray(toPhone)) {
      return toPhone.map((phone) => {
        return { toPhone: phone, text };
      });
    }
  }

  async sendSMS(params: CustomSMSParams | CustomSMSParams[]) {
    let smsToSend = [];
    if (Array.isArray(params)) {
      smsToSend = params.reduce((acc, curr) => {
        return [...acc, ...this.createSMS(curr)];
      }, []);
    } else {
      smsToSend = this.createSMS(params);
    }

    const useSMS = process.env.USE_SMS === 'true';

    return Promise.all(
      smsToSend.map(({ toPhone, text }) => {
        if (useSMS) {
          return new Promise((res, rej) => {
            this.vonage.message.sendSms(
              process.env.MAILJET_FROM_NAME,
              toPhone,
              text,
              {},
              (err, responseData) => {
                if (err) {
                  rej(err);
                } else {
                  if (responseData.messages[0]['status'] === '0') {
                    res(responseData.messages[0]);
                  } else {
                    rej(responseData.messages[0]['error-text']);
                  }
                }
              }
            );
          });
        }
        return Promise.resolve();
      })
    );
  }
}
