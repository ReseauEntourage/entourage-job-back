import { Injectable, Logger, NotFoundException } from '@nestjs/common';
import { SlackService } from 'src/external-services/slack/slack.service';
import { MailsService } from 'src/mails/mails.service';
import { ReportAbuseUserProfileDto } from 'src/user-profiles/dto/report-abuse-user-profile.dto';
import { UsersService } from 'src/users/users.service';

@Injectable()
export class UserProfileModerationService {
  private readonly logger = new Logger(UserProfileModerationService.name);

  constructor(
    private usersService: UsersService,
    private slackService: SlackService,
    private mailsService: MailsService
  ) {}

  async reportAbuse(
    currentUserId: string,
    userId: string,
    reportAbuseDto: ReportAbuseUserProfileDto
  ): Promise<void> {
    const userReported = await this.usersService.findOneWithRelations(userId);
    const userReporter =
      await this.usersService.findOneWithRelations(currentUserId);

    if (!userReported || !userReporter) {
      this.logger.warn(
        `User not found: reported=${userId}, reporter=${currentUserId}`
      );
      throw new NotFoundException();
    }

    await Promise.all([
      this.slackService.sendMessageUserReported(
        userReporter,
        userReported,
        reportAbuseDto.reason,
        reportAbuseDto.comment
      ),
      this.mailsService.sendUserReportedMail(
        reportAbuseDto,
        userReported,
        userReporter
      ),
    ]);
  }
}
