import {
  Controller,
  Get,
  HttpCode,
  HttpStatus,
  Logger,
  Param,
  ParseUUIDPipe,
  Post,
  UseGuards,
} from '@nestjs/common';
import { ApiBearerAuth, ApiOperation, ApiTags } from '@nestjs/swagger';
import { Public, UserPayload } from 'src/auth/guards';
import { UserPermissions, UserPermissionsGuard } from 'src/users/guards';
import { Permissions, UserRole } from 'src/users/users.types';
import { GamificationService } from './gamification.service';

@ApiTags('Gamification')
@ApiBearerAuth()
@Controller('gamification')
export class GamificationController {
  private readonly logger = new Logger(GamificationController.name);

  constructor(private readonly gamificationService: GamificationService) {}

  @Public()
  @Get('achievements/:achievementId/public')
  @ApiOperation({
    summary: 'Get public certificate data for a single achievement',
    description:
      'Returns the coach name, gender, and achievement details for a certificate page. ' +
      'The certificate remains accessible even if the badge has since expired. ' +
      'Only publicly shareable types (e.g. SUPER_ENGAGED_COACH) are returned.',
  })
  getPublicAchievement(
    @Param('achievementId', new ParseUUIDPipe()) achievementId: string
  ) {
    return this.gamificationService.getPublicAchievementById(achievementId);
  }

  @Get('achievement-progression')
  @ApiBearerAuth()
  @ApiOperation({
    summary: 'Get achievement progression stats for the authenticated user',
    description:
      'Returns progression criteria for every achievement the user is eligible for. ' +
      'Used by the frontend to display a progression modal ' +
      'after a triggering action such as sending a message.',
  })
  async getAchievementProgression(
    @UserPayload('id', new ParseUUIDPipe()) id: string,
    @UserPayload('role') role: UserRole
  ) {
    return this.gamificationService.getAllAchievementProgressions(id, role);
  }

  @Post('backfill-achievements')
  @HttpCode(HttpStatus.ACCEPTED)
  @UserPermissions(Permissions.ADMIN)
  @UseGuards(UserPermissionsGuard)
  @ApiOperation({
    summary:
      'Backfill achievement eligibility for all active coaches (Admin only)',
    description:
      'Triggers a one-time re-evaluation of achievements for all non-deleted coaches ' +
      'active in the last 6 months. Returns 202 immediately. Results are reported on Slack (TECH_PRO_MONITORING).',
  })
  backfillAchievements(): { message: string } {
    this.gamificationService.backfillAchievements().catch((err) => {
      this.logger.error(
        '[backfill] Unhandled error during achievement backfill',
        err
      );
    });

    return {
      message:
        'Backfill started. Results will be reported on Slack (TECH_PRO_MONITORING).',
    };
  }
}
