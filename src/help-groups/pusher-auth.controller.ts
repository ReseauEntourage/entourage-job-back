import { Body, Controller, HttpCode, HttpStatus, Post } from '@nestjs/common';
import { ApiBearerAuth, ApiTags } from '@nestjs/swagger';
import { UserPayload } from 'src/auth/guards';
import { User } from 'src/users/models';
import { HelpGroupsParticipationService } from './help-groups-participation.service';

/**
 * Pusher authorization endpoint for private channels, behind the usual JWT
 * guard (logged-in users only). pusher-js posts `socket_id` and
 * `channel_name` as form data. Only the private channel of a help group
 * discussion exists today: a future private channel adds its own branch.
 */
@ApiTags('Pusher')
@ApiBearerAuth()
@Controller('pusher')
export class PusherAuthController {
  constructor(
    private readonly participationService: HelpGroupsParticipationService
  ) {}

  @HttpCode(HttpStatus.OK)
  @Post('auth')
  async authorize(
    @Body() body: { socket_id?: unknown; channel_name?: unknown },
    @UserPayload() user: Partial<User>
  ) {
    return this.participationService.authorizeChannel(
      body?.socket_id,
      body?.channel_name,
      { id: user.id, role: user.role }
    );
  }
}
