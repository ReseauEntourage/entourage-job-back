import { Injectable } from '@nestjs/common';
import Vonage, { SendSms } from '@vonage/server-sdk';
import { CustomSMSParams } from './sms.types';

const useSMS = process.env.USE_SMS === 'true';

@Injectable()
export class VonageService {
  private send: SendSms;

  constructor() {
    const vonage = new Vonage({
      apiKey: process.env.VONAGE_API_KEY,
      apiSecret: process.env.VONAGE_API_SECRET,
    });
    this.send = vonage.message.sendSms;
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

    return Promise.all(
      smsToSend.map(({ toPhone, text }) => {
        if (useSMS) {
          return new Promise((res, rej) => {
            this.send(
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
