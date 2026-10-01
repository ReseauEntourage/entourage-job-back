import {
  Controller,
  Get,
  HttpStatus,
  Param,
  ParseUUIDPipe,
  Query,
} from '@nestjs/common';
import { ApiBearerAuth, ApiTags } from '@nestjs/swagger';
import { UserPayload } from 'src/auth/guards';
import { parsePageLimit } from 'src/posts/posts.utils';
import { User } from 'src/users/models';
import { HelpGroupReader, HelpGroupsService } from './help-groups.service';

const DISCUSSIONS_DEFAULT_LIMIT = 20;
const DISCUSSIONS_MAX_LIMIT = 50;
const REPLIES_DEFAULT_LIMIT = 50;
const REPLIES_MAX_LIMIT = 100;

// An unknown or malformed discussion id is a "page not found"
const discussionIdPipe = new ParseUUIDPipe({
  errorHttpStatusCode: HttpStatus.NOT_FOUND,
});

const toReader = (user: Partial<User>): HelpGroupReader => ({
  id: user.id,
  role: user.role,
});

/**
 * Read routes, open to any logged-in user, member of the group or not.
 */
@ApiTags('Help groups')
@ApiBearerAuth()
@Controller('help-groups')
export class HelpGroupsController {
  constructor(private readonly helpGroupsService: HelpGroupsService) {}

  @Get()
  async findAll(@UserPayload() user: Partial<User>) {
    return this.helpGroupsService.findPublishedCards(toReader(user));
  }

  @Get(':slug')
  async findOne(
    @Param('slug') slug: string,
    @UserPayload() user: Partial<User>
  ) {
    return this.helpGroupsService.findPage(slug, toReader(user));
  }

  @Get(':slug/discussions')
  async findDiscussions(
    @Param('slug') slug: string,
    @UserPayload() user: Partial<User>,
    @Query('cursor') cursor?: string,
    @Query('limit') limit?: string
  ) {
    return this.helpGroupsService.findDiscussions(
      slug,
      toReader(user),
      parsePageLimit(limit, DISCUSSIONS_DEFAULT_LIMIT, DISCUSSIONS_MAX_LIMIT),
      cursor
    );
  }

  @Get(':slug/discussions/:discussionId')
  async findDiscussion(
    @Param('slug') slug: string,
    @Param('discussionId', discussionIdPipe) discussionId: string,
    @UserPayload() user: Partial<User>
  ) {
    return this.helpGroupsService.findDiscussion(
      slug,
      discussionId,
      toReader(user)
    );
  }

  @Get(':slug/discussions/:discussionId/replies')
  async findDiscussionReplies(
    @Param('slug') slug: string,
    @Param('discussionId', discussionIdPipe) discussionId: string,
    @UserPayload() user: Partial<User>,
    @Query('after') after?: string,
    @Query('limit') limit?: string
  ) {
    return this.helpGroupsService.findDiscussionReplies(
      slug,
      discussionId,
      toReader(user),
      parsePageLimit(limit, REPLIES_DEFAULT_LIMIT, REPLIES_MAX_LIMIT),
      after
    );
  }
}
