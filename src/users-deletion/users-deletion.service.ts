import { Injectable } from '@nestjs/common';
import { v4 as uuid } from 'uuid';
import { CVsService } from 'src/cvs/cvs.service';
import { S3Service } from 'src/external-services/aws/s3.service';
import { UpdateOpportunityUserDto } from 'src/opportunities/dto/update-opportunity-user.dto';
import { OpportunityUsersService } from 'src/opportunities/opportunity-users.service';
import { RevisionChangesService } from 'src/revisions/revision-changes.service';
import { RevisionsService } from 'src/revisions/revisions.service';
import { UserProfilesService } from 'src/user-profiles/user-profiles.service';
import { UpdateUserDto } from 'src/users/dto';
import { User, UserCandidat } from 'src/users/models';
import { UserCandidatsService } from 'src/users/user-candidats.service';
import { UsersService } from 'src/users/users.service';
import { generateImageNamesToDelete } from 'src/users/users.utils';

@Injectable()
export class UsersDeletionService {
  constructor(
    private cvsService: CVsService,
    private usersService: UsersService,
    private userProfilesService: UserProfilesService,
    private userCandidatsService: UserCandidatsService,
    private opportunityUsersService: OpportunityUsersService,
    private revisionsService: RevisionsService,
    private revisionChangesService: RevisionChangesService,
    private s3Service: S3Service
  ) {}

  async findOneUser(userId: string) {
    return this.usersService.findOne(userId);
  }

  async findAllOpportunityUsersByCandidateId(candidateId: string) {
    return this.opportunityUsersService.findAllByCandidateId(candidateId);
  }

  async updateUser(userId: string, updateUserDto: UpdateUserDto) {
    return this.usersService.update(userId, updateUserDto);
  }

  async updateOpportunityUsersByCandidateId(
    candidateId: string,
    updateOpportunityUserDto: UpdateOpportunityUserDto
  ) {
    return this.opportunityUsersService.updateByCandidateId(
      candidateId,
      updateOpportunityUserDto
    );
  }

  async updateUserCandidatByCandidatId(
    candidateId: string,
    updateUserCandidatDto: Partial<UserCandidat>
  ) {
    return this.userCandidatsService.updateByCandidateId(
      candidateId,
      updateUserCandidatDto
    );
  }

  async updateUserAndOpportunityUsersRevisionsAndRevisionChanges(
    userId: string,
    opportunityUsersIds: string[]
  ) {
    const documentsIds = [userId, ...opportunityUsersIds];

    const revisions = await this.revisionsService.findAllByDocumentsIds(
      documentsIds
    );
    await this.revisionChangesService.updateByRevisionsIds(
      revisions.map((revision) => {
        return revision.id;
      }),
      {
        document: {},
        diff: [{}],
      }
    );
    await this.revisionsService.updateByDocumentsIds(documentsIds, {
      document: {},
    });
  }

  async removeUser(userId: string) {
    return this.usersService.remove(userId);
  }

  async removeFiles(id: string, firstName: string, lastName: string) {
    await this.s3Service.deleteFiles(
      generateImageNamesToDelete(`${process.env.AWSS3_IMAGE_DIRECTORY}${id}`)
    );
    const pdfFileName = `${firstName}_${lastName}_${id.substring(0, 8)}.pdf`;
    await this.s3Service.deleteFiles(
      `${process.env.AWSS3_FILE_DIRECTORY}${pdfFileName}`
    );
  }

  async removeUserProfile(id: string) {
    await this.userProfilesService.updateByUserId(id, {
      currentJob: null,
      description: null,
    });
    return this.userProfilesService.removeByUserId(id);
  }

  async removeCandidateCVs(id: string) {
    await this.cvsService.updateByCandidateId(id, {
      intro: null,
      story: null,
      transport: null,
      availability: null,
      urlImg: null,
      catchphrase: null,
    });
    return this.cvsService.removeByCandidateId(id);
  }

  async uncacheCandidateCV(url: string) {
    await this.cvsService.uncacheCV(url);
  }

  async cacheAllCVs() {
    await this.cvsService.sendCacheAllCVs();
  }

  async deleteCompleteUser(
    user: User
  ): Promise<{ cvsDeleted: number; userDeleted: number }> {
    const { id, firstName, lastName, candidat } = user.toJSON();

    await this.removeFiles(id, firstName, lastName);

    await this.updateUser(id, {
      firstName: 'Utilisateur',
      lastName: 'supprimé',
      email: `${Date.now()}@${uuid()}.deleted`,
      phone: null,
      address: null,
    });

    if (candidat?.url) {
      await this.uncacheCandidateCV(candidat.url);
    }

    const cvsDeleted = await this.removeCandidateCVs(id);

    await this.updateUserCandidatByCandidatId(id, {
      note: null,
      url: `deleted-${id.substring(0, 8)}`,
    });

    await this.cacheAllCVs();

    const opportunityUsers = await this.findAllOpportunityUsersByCandidateId(
      id
    );

    await this.updateOpportunityUsersByCandidateId(id, {
      note: null,
    });

    await this.updateUserAndOpportunityUsersRevisionsAndRevisionChanges(
      id,
      opportunityUsers.map((opportunityUser) => {
        return opportunityUser.id;
      })
    );

    await this.removeUserProfile(id);

    const userDeleted = await this.removeUser(id);
    return {
      userDeleted,
      cvsDeleted,
    };
  }
}
