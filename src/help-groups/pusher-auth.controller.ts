import {
  Body,
  Controller,
  ForbiddenException,
  HttpCode,
  HttpStatus,
  Post,
} from '@nestjs/common';
import { ApiBearerAuth, ApiTags } from '@nestjs/swagger';
import { UserPayload } from 'src/auth/guards';
import { NotificationsService } from 'src/notifications/notifications.service';
import { User } from 'src/users/models';
import { HelpGroupsParticipationService } from './help-groups-participation.service';

/**
 * Pusher authorization endpoint for private channels, behind the usual JWT
 * guard (logged-in users only). pusher-js posts `socket_id` and
 * `channel_name` as form data. Two private channels exist: the channel of a
 * help group discussion, and the channel of a user (notifications center),
 * signed for this user only. Any other channel name is refused.
 */
@ApiTags('Pusher')
@ApiBearerAuth()
@Controller('pusher')
export class PusherAuthController {
  constructor(
    private readonly participationService: HelpGroupsParticipationService,
    private readonly notificationsService: NotificationsService
  ) {}

  @HttpCode(HttpStatus.OK)
  @Post('auth')
  async authorize(
    @Body() body: { socket_id?: unknown; channel_name?: unknown },
    @UserPayload() user: Partial<User>
  ) {
    const socketId = body?.socket_id;
    const channelName = body?.channel_name;
    if (
      typeof channelName === 'string' &&
      this.notificationsService.isUserChannel(channelName)
    ) {
      // Untrusted request body: anything but a string is refused, not a 500
      if (typeof socketId !== 'string') {
        throw new ForbiddenException();
      }
      return this.notificationsService.authorizeUserChannel(
        socketId,
        channelName,
        user.id
      );
    }
    return this.participationService.authorizeChannel(socketId, channelName, {
      id: user.id,
      role: user.role,
    });
  }
}
