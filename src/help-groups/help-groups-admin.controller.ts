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
import { CreateHelpGroupDto, UpdateHelpGroupDto } from './dto';
import { HelpGroupsAdminService } from './help-groups-admin.service';

const helpGroupBodyPipe = new ValidationPipe({
  whitelist: true,
  forbidNonWhitelisted: true,
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
    private readonly helpGroupsAdminService: HelpGroupsAdminService
  ) {}

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
