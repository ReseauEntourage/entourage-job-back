import { Controller, Get, ParseUUIDPipe } from '@nestjs/common';
import {
  ApiBearerAuth,
  ApiOkResponse,
  ApiOperation,
  ApiTags,
} from '@nestjs/swagger';
import { Throttle } from '@nestjs/throttler';
import { UserPayload } from 'src/auth/guards';
import type { UserRole } from 'src/users/users.types';
import { AssistantToolsService } from './assistant-tools.service';
import {
  AssistantIdentityDto,
  generateAssistantIdentityDto,
} from './dto/assistant-identity.dto';

/**
 * Maximum number of calls per user and per window on the whole group. Aligned
 * on the other read routes of Pro (`GET /current`).
 */
export const ASSISTANT_TOOLS_THROTTLE_LIMIT = 60;
export const ASSISTANT_TOOLS_THROTTLE_TTL_MS = 60000;

/**
 * Routes called by the AI assistant on behalf of a connected user, with that
 * user's own token. Rules of the group (spec `assistant-tools-endpoints`):
 *
 * - never `@Public()` nor `@AllowWithoutPassword()`: every refusal of the
 *   global `JwtAuthGuard` and of `JwtStrategy` applies as is;
 * - read only by default, and only the fields the assistant needs. Never a
 *   password, a token or a secret;
 * - no activity written: no session created, `lastConnection` untouched, so
 *   that using the assistant does not count as a connection to Pro;
 * - rate limited per authenticated user and not per IP address: the assistant
 *   calls from a single server, so an IP key would be shared by all its users.
 *
 * Governance: each new route widens what the assistant can read at Pro. It
 * goes through (1) the review of the Pro team, (2) the opinion of the DPO
 * (dpo@entourage.social) as soon as it returns one more personal datum, and
 * (3) the dedicated checkbox of the pull request template ("personal data of
 * users is added to the data sent to the AI").
 */
@ApiTags('AssistantTools')
@ApiBearerAuth()
@Throttle({
  default: {
    limit: ASSISTANT_TOOLS_THROTTLE_LIMIT,
    ttl: ASSISTANT_TOOLS_THROTTLE_TTL_MS,
    // The global `JwtAuthGuard` runs before the throttler, so `request.user` is
    // set here: the key is the user, falling back to the IP address.
    getTracker: (req: { ip?: string; user?: { id?: string } }) =>
      req.user?.id ?? req.ip ?? '',
  },
})
@Controller('assistant-tools')
export class AssistantToolsController {
  constructor(private readonly assistantToolsService: AssistantToolsService) {}

  @ApiOperation({
    summary: 'Identity of the user behind the token',
    description:
      'Verifies the token of a Pro user and returns the minimum the AI assistant needs to address them: identifier, first name and role. Read only, and it does not count as a connection (no session, `lastConnection` untouched).',
  })
  @ApiOkResponse({ type: AssistantIdentityDto })
  @Get('identity')
  async getIdentity(
    @UserPayload('id', new ParseUUIDPipe()) id: string,
    @UserPayload('role') role: UserRole
  ): Promise<AssistantIdentityDto> {
    const firstName = await this.assistantToolsService.findFirstName(id);
    return generateAssistantIdentityDto(id, role, firstName);
  }
}
