import {
  BadRequestException,
  Body,
  Controller,
  Get,
  Param,
  ParseEnumPipe,
  ParseUUIDPipe,
  Post,
  Query,
  UseGuards,
  ValidationPipe,
} from '@nestjs/common';
import { ApiBearerAuth, ApiTags } from '@nestjs/swagger';
import { UserPayload } from 'src/auth/guards';
import { ErrorMessagingInvalidCursor } from 'src/messaging/messaging.errors';
import { decodeMessageCursor } from 'src/messaging/messaging.utils';
import type { ReportTargetType } from 'src/reports/reports.types';
import { ReportTargetTypes } from 'src/reports/reports.types';
import { UserPermissions, UserPermissionsGuard } from 'src/users/guards';
import { Permissions } from 'src/users/users.types';
import {
  ReportsPendingCountQueryDto,
  ReportTargetsQueryDto,
  ResolveReportTargetDto,
} from './dto';
import { ReportsAdminService } from './reports-admin.service';

const validationPipe = new ValidationPipe({
  whitelist: true,
  forbidNonWhitelisted: true,
  transform: true,
});

const targetTypePipe = new ParseEnumPipe(ReportTargetTypes);

/**
 * "Signalements" admin tab, reserved to Entourage admins.
 * `UserPermissionsGuard` reads the handler metadata only: every route must
 * carry its own `@UserPermissions`.
 */
@ApiTags('Reports - Admin')
@ApiBearerAuth()
@Controller('admin/reports')
export class ReportsAdminController {
  constructor(private readonly reportsAdminService: ReportsAdminService) {}

  @UserPermissions(Permissions.ADMIN)
  @UseGuards(UserPermissionsGuard)
  @Get('targets')
  async findTargets(@Query(validationPipe) query: ReportTargetsQueryDto) {
    return this.reportsAdminService.findTargets(query);
  }

  @UserPermissions(Permissions.ADMIN)
  @UseGuards(UserPermissionsGuard)
  @Get('pending-count')
  async countPendingTargets(
    @Query(validationPipe) query: ReportsPendingCountQueryDto
  ) {
    return this.reportsAdminService.countPendingTargets(query.zone);
  }

  @UserPermissions(Permissions.ADMIN)
  @UseGuards(UserPermissionsGuard)
  @Get('targets/CONVERSATION/:conversationId/messages')
  async findConversationMessages(
    @Param('conversationId', new ParseUUIDPipe()) conversationId: string,
    @Query('before') before?: string
  ) {
    let cursor;
    try {
      cursor = before ? decodeMessageCursor(before) : undefined;
    } catch (error) {
      if (error instanceof ErrorMessagingInvalidCursor) {
        throw new BadRequestException('Cursor de pagination invalide.');
      }
      throw error;
    }
    return this.reportsAdminService.findConversationMessages(
      conversationId,
      cursor
    );
  }

  @UserPermissions(Permissions.ADMIN)
  @UseGuards(UserPermissionsGuard)
  @Get('targets/:targetType/:targetId')
  async findTarget(
    @Param('targetType', targetTypePipe) targetType: ReportTargetType,
    @Param('targetId', new ParseUUIDPipe()) targetId: string
  ) {
    return this.reportsAdminService.findTarget({ targetType, targetId });
  }

  @UserPermissions(Permissions.ADMIN)
  @UseGuards(UserPermissionsGuard)
  @Post('targets/:targetType/:targetId/resolve')
  async resolveTarget(
    @Param('targetType', targetTypePipe) targetType: ReportTargetType,
    @Param('targetId', new ParseUUIDPipe()) targetId: string,
    @Body(validationPipe) dto: ResolveReportTargetDto,
    @UserPayload('id') adminId: string
  ) {
    return this.reportsAdminService.resolveTarget(
      { targetType, targetId },
      adminId,
      dto
    );
  }
}
