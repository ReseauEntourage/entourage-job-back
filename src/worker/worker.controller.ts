import { Controller, Get, Query } from '@nestjs/common';
import { RequireApiKey } from 'src/api-keys/decorators';
import { Public } from 'src/auth/guards';
import { RecruitementAlertsService } from 'src/common/recruitement-alerts/recruitement-alerts.service';
import { UsersService } from 'src/users/users.service';
import { getZoneFromDepartment } from 'src/utils/misc';
import { MailerRecruitementAlert } from './MailerRecruitementAlert';

// secured by API key
@RequireApiKey()
// allow access without user authentication
@Public()
@Controller('worker')
export class WorkerController {
  constructor(
    private readonly recruitementAlertsService: RecruitementAlertsService,
    private readonly userService: UsersService
  ) {}

  // Preparing data for the recruitement alert email worker
  // Returns a list of alertId and associated user emails to notify
  // Only returns if the alerts have new matching candidates since last notification
  @Get('/recruitment-alert')
  async getWorkerCompanyRecruitementAlertsToSend(
    @Query('markAsNotified') markAsNotified = true
  ) {
    try {
      const recruitementAlertsToSend: MailerRecruitementAlert[] = [];
      // Get all recruitement alerts
      const recruitementAlerts = await this.recruitementAlertsService.findAll();

      // Loop recruitement alerts
      // using for..of to allow await in the loop and respect async operations
      for (const alert of recruitementAlerts) {
        const matchingUsers =
          await this.recruitementAlertsService.getRecruitementAlertMatching(
            alert.id
          );

        if (matchingUsers.length === 0) {
          continue;
        }

        // Get user ids already notified for this alert
        const alreadyNotifiedUserIds = await this.recruitementAlertsService
          .findRecruitementAlertNotifiedCandidate(alert.id)
          .then((notifiedCandidates) =>
            notifiedCandidates.map((candidate) => candidate.userId)
          );

        // Find the difference between matchingUsers and alreadyNotifiedUserIds
        const newMatchingUsers = matchingUsers.filter(
          (user) => !alreadyNotifiedUserIds.includes(user.id)
        );

        if (newMatchingUsers.length !== 0) {
          // Getting the company admin email
          const companyAdmin = alert.company.companyUsers.find(
            (cu) => cu.isAdmin
          );
          if (!companyAdmin) {
            // noone to notify
            continue;
          }
          const adminUserDetails = await this.userService.findOne(
            companyAdmin.userId
          );

          recruitementAlertsToSend.push({
            alertId: alert.id,
            alertName: alert.name,
            newCandidatesCount: newMatchingUsers.length,
            companyAdminEmail: adminUserDetails.email,
            firstName: adminUserDetails.firstName,
            zone: getZoneFromDepartment(
              adminUserDetails.userProfile.department
            ),
          });

          // Mark users as notified for this alert
          if (markAsNotified) {
            await this.recruitementAlertsService.markUsersAsNotified(
              alert.id,
              newMatchingUsers.map((user) => user.id)
            );
          }
        }
      }

      return recruitementAlertsToSend;
    } catch (error) {
      console.error(error);
      throw error;
    }
  }
}
