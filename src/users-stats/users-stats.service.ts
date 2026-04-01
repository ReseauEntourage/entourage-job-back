import { Injectable } from '@nestjs/common';
import { MessagingService } from 'src/messaging/messaging.service';
import { UserRole } from 'src/users/users.types';

@Injectable()
export class UsersStatsService {
  constructor(private messagingService: MessagingService) {}

  async getAverageDelayResponse(userId: string) {
    return this.messagingService.getAverageDelayResponse(userId);
  }

  async getResponseRate(userId: string) {
    return this.messagingService.getResponseRate(userId);
  }

  async getTotalConversationWithMirrorRoleCount(
    userId: string,
    userRole: UserRole
  ) {
    return this.messagingService.getMirrorRoleConversationCount(
      userId,
      userRole
    );
  }
}
