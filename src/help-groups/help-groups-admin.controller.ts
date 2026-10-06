import {
  Body,
  Controller,
  Delete,
  Get,
  HttpCode,
  Param,
  ParseUUIDPipe,
  Post,
  Put,
  Query,
  UseGuards,
  ValidationPipe,
} from '@nestjs/common';
import { ApiBearerAuth, ApiTags } from '@nestjs/swagger';
import { UserPayload } from 'src/auth/guards';
import { UserPermissions, UserPermissionsGuard } from 'src/users/guards';
import { Permissions } from 'src/users/users.types';
import {
  CreateHelpGroupDto,
  ModerationDeleteDto,
  UpdateHelpGroupDto,
} from './dto';
import { HelpGroupsAdminService } from './help-groups-admin.service';
import { HelpGroupsParticipationService } from './help-groups-participation.service';
import { HelpGroupsReportingService } from './help-groups-reporting.service';

const helpGroupBodyPipe = new ValidationPipe({
  whitelist: true,
  forbidNonWhitelisted: true,
});

const moderationBodyPipe = new ValidationPipe({
  whitelist: true,
  forbidNonWhitelisted: true,
  transform: true,
});

/**
 * Administration of help groups, reserved to Entourage admins (company
 * admins included in the refusal). Kept apart from the `help-groups` read
 * routes to avoid any collision with `/help-groups/:slug`.
 * `UserPermissionsGuard` reads the handler metadata only: every route must
 * carry its own `@UserPermissions`.
 */
@ApiTags('Help groups - Admin')
@ApiBearerAuth()
@Controller('admin/help-groups')
export class HelpGroupsAdminController {
  constructor(
    private readonly helpGroupsAdminService: HelpGroupsAdminService,
    private readonly participationService: HelpGroupsParticipationService,
    private readonly reportingService: HelpGroupsReportingService
  ) {}

  /**
   * Moderation deletion of a discussion (and so of its replies), with a
   * mandatory motive. An admin deleting their own message uses the author
   * route instead. The author is not notified.
   */
  @UserPermissions(Permissions.ADMIN)
  @UseGuards(UserPermissionsGuard)
  @HttpCode(204)
  @Delete('discussions/:discussionId')
  async moderateDiscussion(
    @Param('discussionId', new ParseUUIDPipe()) discussionId: string,
    @Body(moderationBodyPipe) dto: ModerationDeleteDto,
    @UserPayload('id') adminId: string
  ) {
    await this.participationService.moderateDiscussion(
      discussionId,
      adminId,
      dto
    );
  }

  @UserPermissions(Permissions.ADMIN)
  @UseGuards(UserPermissionsGuard)
  @HttpCode(204)
  @Delete('replies/:replyId')
  async moderateReply(
    @Param('replyId', new ParseUUIDPipe()) replyId: string,
    @Body(moderationBodyPipe) dto: ModerationDeleteDto,
    @UserPayload('id') adminId: string
  ) {
    await this.participationService.moderateReply(replyId, adminId, dto);
  }

  /**
   * Makes a message hidden after reports visible again to everyone, and
   * closes its pending reports. Deleting it goes through the moderation
   * deletion above, which closes them too.
   */
  @UserPermissions(Permissions.ADMIN)
  @UseGuards(UserPermissionsGuard)
  @HttpCode(204)
  @Post('discussions/:discussionId/restore')
  async restoreDiscussion(
    @Param('discussionId', new ParseUUIDPipe()) discussionId: string,
    @UserPayload('id') adminId: string
  ) {
    await this.reportingService.restoreDiscussion(discussionId, adminId);
  }

  @UserPermissions(Permissions.ADMIN)
  @UseGuards(UserPermissionsGuard)
  @HttpCode(204)
  @Post('replies/:replyId/restore')
  async restoreReply(
    @Param('replyId', new ParseUUIDPipe()) replyId: string,
    @UserPayload('id') adminId: string
  ) {
    await this.reportingService.restoreReply(replyId, adminId);
  }

  @UserPermissions(Permissions.ADMIN)
  @UseGuards(UserPermissionsGuard)
  @Get('discussions/:discussionId/revisions')
  async findDiscussionRevisions(
    @Param('discussionId', new ParseUUIDPipe()) discussionId: string
  ) {
    return this.participationService.findRevisions('postId', discussionId);
  }

  @UserPermissions(Permissions.ADMIN)
  @UseGuards(UserPermissionsGuard)
  @Get('replies/:replyId/revisions')
  async findReplyRevisions(
    @Param('replyId', new ParseUUIDPipe()) replyId: string
  ) {
    return this.participationService.findRevisions('replyId', replyId);
  }

  @UserPermissions(Permissions.ADMIN)
  @UseGuards(UserPermissionsGuard)
  @Get()
  async findAll(@Query('deleted') deleted?: string) {
    return this.helpGroupsAdminService.findAll(deleted === 'true');
  }

  @UserPermissions(Permissions.ADMIN)
  @UseGuards(UserPermissionsGuard)
  @Post()
  async create(
    @Body(helpGroupBodyPipe) createHelpGroupDto: CreateHelpGroupDto,
    @UserPayload('id') adminId: string
  ) {
    return this.helpGroupsAdminService.create(createHelpGroupDto, adminId);
  }

  @UserPermissions(Permissions.ADMIN)
  @UseGuards(UserPermissionsGuard)
  @Put(':id')
  async update(
    @Param('id', new ParseUUIDPipe()) id: string,
    @Body(helpGroupBodyPipe) updateHelpGroupDto: UpdateHelpGroupDto
  ) {
    return this.helpGroupsAdminService.update(id, updateHelpGroupDto);
  }

  @UserPermissions(Permissions.ADMIN)
  @UseGuards(UserPermissionsGuard)
  @HttpCode(200)
  @Post(':id/publish')
  async publish(@Param('id', new ParseUUIDPipe()) id: string) {
    return this.helpGroupsAdminService.publish(id);
  }

  @UserPermissions(Permissions.ADMIN)
  @UseGuards(UserPermissionsGuard)
  @HttpCode(200)
  @Post(':id/unpublish')
  async unpublish(@Param('id', new ParseUUIDPipe()) id: string) {
    return this.helpGroupsAdminService.unpublish(id);
  }

  @UserPermissions(Permissions.ADMIN)
  @UseGuards(UserPermissionsGuard)
  @HttpCode(200)
  @Post(':id/pin')
  async pin(@Param('id', new ParseUUIDPipe()) id: string) {
    return this.helpGroupsAdminService.pin(id);
  }

  @UserPermissions(Permissions.ADMIN)
  @UseGuards(UserPermissionsGuard)
  @HttpCode(200)
  @Post(':id/unpin')
  async unpin(@Param('id', new ParseUUIDPipe()) id: string) {
    return this.helpGroupsAdminService.unpin(id);
  }

  @UserPermissions(Permissions.ADMIN)
  @UseGuards(UserPermissionsGuard)
  @HttpCode(200)
  @Post(':id/restore')
  async restore(@Param('id', new ParseUUIDPipe()) id: string) {
    return this.helpGroupsAdminService.restore(id);
  }

  @UserPermissions(Permissions.ADMIN)
  @UseGuards(UserPermissionsGuard)
  @HttpCode(204)
  @Delete(':id')
  async remove(
    @Param('id', new ParseUUIDPipe()) id: string,
    @UserPayload('id') adminId: string
  ) {
    await this.helpGroupsAdminService.remove(id, adminId);
  }
}
