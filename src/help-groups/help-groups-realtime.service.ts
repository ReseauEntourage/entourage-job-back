import { Injectable, Logger } from '@nestjs/common';
import { PusherService } from 'src/external-services/pusher/pusher.service';
import {
  getPostPrivateChannel,
  PostRealtimePayload,
  PusherEvent,
} from 'src/external-services/pusher/pusher.types';

/**
 * Signals the activity of a discussion on its private channel, once the
 * write transaction is committed. The payload only carries ids: the front
 * reloads what changed through the read routes. A Pusher failure is logged
 * and never fails the write.
 */
@Injectable()
export class HelpGroupsRealtimeService {
  private readonly logger = new Logger(HelpGroupsRealtimeService.name);

  constructor(private readonly pusherService: PusherService) {}

  notify(event: PusherEvent, payload: PostRealtimePayload): void {
    this.pusherService
      .sendEvent(getPostPrivateChannel(payload.discussionId), event, payload)
      .catch((error) => {
        this.logger.warn(
          `[HelpGroupsRealtime] ${event} not sent (discussionId=${
            payload.discussionId
          }): ${error instanceof Error ? error.message : String(error)}`
        );
      });
  }
}
