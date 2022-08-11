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

    if (user.role === UserRoles.CANDIDAT) {
      // TODO check cache manager
      await this.usersDeletionService.uncacheCandidateCV(candidat.url);
      await this.usersDeletionService.updateUserCandidatByCandidatId(userId, {
        note: null,
        url: `deleted-${userId.substring(0, 8)}`,
      });
    }

    /*
    // TODO when opportunities
    const userOpportunitiesQuery = {
      where: {
        UserId: id,
      },
    };

    const userOpportunities = await Opportunity_User.findAll(
      userOpportunitiesQuery
    );

    await Opportunity_User.update(
      {
        note: null,
      },
      userOpportunitiesQuery
    );
    */

    /*
    // TODO when revisions work
    const revisionsQuery = {
      where: {
        [Op.or]: [
          { documentId: id },
          {
            documentId: userOpportunities.map((userOpp) => {
              return userOpp.id;
            }),
          },
        ],
      },
    };

    const revisions = await Revision.findAll(revisionsQuery);

    // Have to use raw query because Revision_Change is not declared as a models
    await sequelize.query(
      `
      UPDATE "RevisionChanges"
      SET "document" = '{}'::jsonb, "diff" = '[{}]'::jsonb
      WHERE "revisionId" IN (${revisions.map((revision) => {
        return `'${revision.id}'`;
      })});
    `,
      {
        type: QueryTypes.UPDATE,
      }
    );

    await Revision.update(
      {
        document: {},
      },
      revisionsQuery
    );
    */

    const cvsDeleted = await this.usersDeletionService.removeCandidateCVs(
      userId
    );
    await this.usersDeletionService.cacheAllCVs();

    // Todo change to userDeleted
    const usersDeleted = await this.usersDeletionService.removeUser(userId);

    return { usersDeleted, cvsDeleted };
  }
}
