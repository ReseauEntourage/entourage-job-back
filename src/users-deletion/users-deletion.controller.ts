import {
  Controller,
  Delete,
  NotFoundException,
  Param,
  ParseUUIDPipe,
  UseGuards,
} from '@nestjs/common';
import { v4 as uuid } from 'uuid';
import { Roles, RolesGuard } from 'src/users/guards';
import { UserRoles } from 'src/users/users.types';
import { UsersDeletionService } from './users-deletion.service';

// TODO change to users
@Controller('user')
export class UsersDeletionController {
  constructor(private readonly usersDeletionService: UsersDeletionService) {}

  @Roles(UserRoles.ADMIN)
  @UseGuards(RolesGuard)
  @Delete(':id')
  async removeUser(@Param('id', new ParseUUIDPipe()) userId: string) {
    const user = await this.usersDeletionService.findOneUser(userId);

    if (!user) {
      throw new NotFoundException();
    }

    const { firstName, lastName, candidat } = user.toJSON();

    await this.usersDeletionService.removeFiles(userId, firstName, lastName);

    await this.usersDeletionService.updateUser(userId, {
      firstName: 'Utilisateur',
      lastName: 'supprimé',
      email: `${Date.now()}@${uuid()}.deleted`,
      phone: null,
      address: null,
    });

    await this.usersDeletionService.uncacheCandidateCV(candidat.url);
    const cvsDeleted = await this.usersDeletionService.removeCandidateCVs(
      userId
    );

    await this.usersDeletionService.updateUserCandidatByCandidatId(userId, {
      note: null,
      url: `deleted-${userId.substring(0, 8)}`,
    });

    await this.usersDeletionService.cacheAllCVs();

    const opportunityUsers =
      await this.usersDeletionService.findAllOpportunityUsersByCandidateId(
        userId
      );

    await this.usersDeletionService.updateOpportunityUsersByCandidateId(
      userId,
      {
        note: null,
      }
    );

    await this.usersDeletionService.updateUserAndOpportunityUsersRevisionsAndRevisionChanges(
      userId,
      opportunityUsers.map((opportunityUser) => {
        return opportunityUser.id;
      })
    );

    // Todo change to userDeleted
    const usersDeleted = await this.usersDeletionService.removeUser(userId);

    return { usersDeleted, cvsDeleted };
  }
}
