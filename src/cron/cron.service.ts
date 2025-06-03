import { Injectable, Logger } from '@nestjs/common';
import { Cron, CronExpression } from '@nestjs/schedule';
import { User } from 'src/users/models';
import { UsersService } from 'src/users/users.service';
import { UsersDeletionService } from 'src/users-deletion/users-deletion.service';

@Injectable()
export class CronService {
  private readonly logger = new Logger(CronService.name);

  constructor(
    private readonly usersService: UsersService,
    private readonly usersDeletionService: UsersDeletionService
  ) {}

  /**
   * This method is called every day at 1 AM.
   * It will delete every user that has not been connected for 25 months.
   */
  @Cron(CronExpression.EVERY_DAY_AT_1AM)
  async deleteInactiveUsers() {
    this.logger.log('Deleting inactive users...');
    const inactiveUsers = await this.usersService.getInactiveUsersForDeletion();
    await Promise.all(
      inactiveUsers.map(async (user) => {
        this.logger.log(`Deleting user ${user.id}`);
        await this.usersDeletionService.deleteCompleteUser(user as User);
      })
    );
  }
}
