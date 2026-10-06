import {
  ForbiddenException,
  Injectable,
  Logger,
  NotFoundException,
} from '@nestjs/common';
import { SlackService } from 'src/external-services/slack/slack.service';
import { ReportsService } from 'src/reports/reports.service';
import {
  ReportReasonLabels,
  ReportTargetTypes,
} from 'src/reports/reports.types';
import { ReportAbuseUserProfileDto } from 'src/user-profiles/dto/report-abuse-user-profile.dto';
import { UsersService } from 'src/users/users.service';

@Injectable()
export class UserProfileModerationService {
  private readonly logger = new Logger(UserProfileModerationService.name);

  constructor(
    private usersService: UsersService,
    private slackService: SlackService,
    private reportsService: ReportsService
  ) {}

  /**
   * Saves the report of a profile, with the zone of the reported person, then
   * alerts the moderation channel (never by email). 403 on one's own profile,
   * 404 on a missing or deleted profile, 409 when a report of the same person
   * on this profile is still to handle. A reported person without referent,
   * or a Slack failure, never fails the report.
   */
  async reportAbuse(
    currentUserId: string,
    userId: string,
    reportAbuseDto: ReportAbuseUserProfileDto
  ): Promise<{ id: string }> {
    if (currentUserId === userId) {
      throw new ForbiddenException();
    }
    const userReported = await this.usersService.findOneWithRelations(userId);
    const userReporter =
      await this.usersService.findOneWithRelations(currentUserId);

    if (!userReported || !userReporter) {
      this.logger.warn(
        `User not found: reported=${userId}, reporter=${currentUserId}`
      );
      throw new NotFoundException();
    }

    const report = await this.reportsService.create({
      targetType: ReportTargetTypes.USER_PROFILE,
      targetId: userReported.id,
      reporterId: userReporter.id,
      reason: reportAbuseDto.reason,
      comment: reportAbuseDto.comment,
      zone: userReported.zone ?? null,
    });

    try {
      await this.slackService.sendMessageUserReported(
        userReporter,
        userReported,
        ReportReasonLabels[reportAbuseDto.reason],
        reportAbuseDto.comment || null
      );
    } catch (error) {
      this.logger.error(
        `Slack alert not sent for the report of the profile ${userReported.id}: ${
          error instanceof Error ? error.message : String(error)
        }`
      );
    }
    return { id: report.id };
  }
}
