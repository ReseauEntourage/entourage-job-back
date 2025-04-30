import { Injectable } from '@nestjs/common';
import { MessagingService } from 'src/messaging/messaging.service';

@Injectable()
export class UsersStatsService {
  constructor(private messagingService: MessagingService) {}

  async getAverageDelayResponse(userId: string) {
    return this.messagingService.getAverageDelayResponse(userId);
  }

  async getResponseRate(userId: string) {
    return this.messagingService.getResponseRate(userId);
  }
}
