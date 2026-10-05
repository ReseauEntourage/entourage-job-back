import {
  Body,
  Controller,
  Delete,
  HttpCode,
  HttpStatus,
  Param,
  ParseUUIDPipe,
  Patch,
  Post,
  Put,
  ValidationPipe,
} from '@nestjs/common';
import { ApiBearerAuth, ApiTags } from '@nestjs/swagger';
import { Throttle } from '@nestjs/throttler';
import { UserPayload } from 'src/auth/guards';
import {
  CreateDiscussionDto,
  CreateReplyDto,
  RemoveReactionDto,
  SetReactionDto,
  TitleSuggestionDto,
  UpdateDiscussionDto,
  UpdateReplyDto,
} from './dto';
import { HelpGroupsParticipationService } from './help-groups-participation.service';
import { HelpGroupsTitleService } from './help-groups-title.service';
import { HelpGroupsWriteGuardService } from './help-groups-write-guard.service';

const bodyPipe = new ValidationPipe({
  whitelist: true,
  forbidNonWhitelisted: true,
  transform: true,
});

// An unknown or malformed id is a "page not found"
const idPipe = new ParseUUIDPipe({ errorHttpStatusCode: HttpStatus.NOT_FOUND });

/**
 * Write routes of the members. Every write goes through the single write
 * control of `HelpGroupsWriteGuardService`, except editing and deleting
 * one's own message, which only checks the authorship.
 */
@ApiTags('Help groups - Participation')
@ApiBearerAuth()
@Controller('help-groups')
export class HelpGroupsParticipationController {
  constructor(
    private readonly participationService: HelpGroupsParticipationService,
    private readonly titleService: HelpGroupsTitleService,
    private readonly writeGuard: HelpGroupsWriteGuardService
  ) {}

  @HttpCode(HttpStatus.OK)
  @Post(':slug/membership')
  async join(@Param('slug') slug: string, @UserPayload('id') userId: string) {
    return this.participationService.join(slug, userId);
  }

  @HttpCode(HttpStatus.OK)
  @Delete(':slug/membership')
  async leave(@Param('slug') slug: string, @UserPayload('id') userId: string) {
    return this.participationService.leave(slug, userId);
  }

  @Post(':slug/discussions')
  async createDiscussion(
    @Param('slug') slug: string,
    @UserPayload('id') userId: string,
    @Body(bodyPipe) dto: CreateDiscussionDto
  ) {
    return this.participationService.createDiscussion(slug, userId, dto);
  }

  /**
   * Proposes a title from the message. 200 with `{ title: null }` on any
   * failure: the member then writes their title. The 5 proposals per draft
   * limit is applied by the front; this per user limit is a safeguard.
   */
  @Throttle({
    default: {
      limit: 20,
      ttl: 60000,
      getTracker: (req: { ip?: string; user?: { id?: string } }) =>
        req.user?.id ?? req.ip ?? '',
    },
  })
  @HttpCode(HttpStatus.OK)
  @Post(':slug/discussions/title-suggestions')
  async suggestTitle(
    @Param('slug') slug: string,
    @UserPayload('id') userId: string,
    @Body(bodyPipe) dto: TitleSuggestionDto
  ) {
    await this.writeGuard.assertCanWrite(userId, slug);
    return this.titleService.suggestTitle(dto.content, dto.previousTitles);
  }

  @Patch(':slug/discussions/:discussionId')
  async updateDiscussion(
    @Param('slug') slug: string,
    @Param('discussionId', idPipe) discussionId: string,
    @UserPayload('id') userId: string,
    @Body(bodyPipe) dto: UpdateDiscussionDto
  ) {
    return this.participationService.updateDiscussion(
      slug,
      discussionId,
      userId,
      dto
    );
  }

  @HttpCode(HttpStatus.NO_CONTENT)
  @Delete(':slug/discussions/:discussionId')
  async deleteDiscussion(
    @Param('slug') slug: string,
    @Param('discussionId', idPipe) discussionId: string,
    @UserPayload('id') userId: string
  ) {
    await this.participationService.deleteDiscussion(
      slug,
      discussionId,
      userId
    );
  }

  @Post(':slug/discussions/:discussionId/replies')
  async createReply(
    @Param('slug') slug: string,
    @Param('discussionId', idPipe) discussionId: string,
    @UserPayload('id') userId: string,
    @Body(bodyPipe) dto: CreateReplyDto
  ) {
    return this.participationService.createReply(
      slug,
      discussionId,
      userId,
      dto
    );
  }

  @Patch(':slug/discussions/:discussionId/replies/:replyId')
  async updateReply(
    @Param('slug') slug: string,
    @Param('discussionId', idPipe) discussionId: string,
    @Param('replyId', idPipe) replyId: string,
    @UserPayload('id') userId: string,
    @Body(bodyPipe) dto: UpdateReplyDto
  ) {
    return this.participationService.updateReply(
      slug,
      discussionId,
      replyId,
      userId,
      dto
    );
  }

  @HttpCode(HttpStatus.NO_CONTENT)
  @Delete(':slug/discussions/:discussionId/replies/:replyId')
  async deleteReply(
    @Param('slug') slug: string,
    @Param('discussionId', idPipe) discussionId: string,
    @Param('replyId', idPipe) replyId: string,
    @UserPayload('id') userId: string
  ) {
    await this.participationService.deleteReply(
      slug,
      discussionId,
      replyId,
      userId
    );
  }

  @Put(':slug/discussions/:discussionId/reactions')
  async setReaction(
    @Param('slug') slug: string,
    @Param('discussionId', idPipe) discussionId: string,
    @UserPayload('id') userId: string,
    @Body(bodyPipe) dto: SetReactionDto
  ) {
    return this.participationService.setReaction(
      slug,
      discussionId,
      userId,
      dto.target,
      dto.emoji
    );
  }

  @HttpCode(HttpStatus.OK)
  @Delete(':slug/discussions/:discussionId/reactions')
  async removeReaction(
    @Param('slug') slug: string,
    @Param('discussionId', idPipe) discussionId: string,
    @UserPayload('id') userId: string,
    @Body(bodyPipe) dto: RemoveReactionDto
  ) {
    return this.participationService.removeReaction(
      slug,
      discussionId,
      userId,
      dto.target
    );
  }
}
