import { Injectable } from '@nestjs/common';
import Pusher from 'pusher';
import { PusherChannel, PusherEvent } from './pusher.types';

@Injectable()
export class PusherService {
  private pusher: Pusher;

  constructor() {
    // TODO FIX BECAUSE NOT WORKING
    this.pusher = new Pusher({
      appId: process.env.PUSHER_APP_ID,
      key: process.env.PUSHER_API_KEY,
      secret: process.env.PUSHER_API_SECRET,
      cluster: 'eu',
      useTLS: true,
    });
  }

  async sendEvent<T>(channel: PusherChannel, event: PusherEvent, data: T) {
    return this.pusher.trigger(channel, event, data);
  }
}
