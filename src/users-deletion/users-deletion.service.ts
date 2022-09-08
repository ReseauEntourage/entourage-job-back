import { Injectable } from '@nestjs/common';
import { RevisionChangesService } from 'src/revisions/revision-changes.service';
import { S3Service } from 'src/aws/s3.service';
import { CVsService } from 'src/cvs/cvs.service';
import { UpdateOpportunityUserDto } from 'src/opportunities/dto/update-opportunity-user.dto';
import { OpportunityUser } from 'src/opportunities/models/opportunity-user.model';
import { OpportunityUsersService } from 'src/opportunities/opportunity-users.service';
import { RevisionsService } from 'src/revisions/revisions.service';
import { UpdateUserCandidatDto, UpdateUserDto } from 'src/users/dto';
import { UserCandidatsService } from 'src/users/user-candidats.service';
import { UsersService } from 'src/users/users.service';
import { generateImageNamesToDelete } from 'src/users/users.utils';

@Injectable()
export class UsersDeletionService {
  constructor(
    private cvsService: CVsService,
    private usersService: UsersService,
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
    updateUserCandidatDto: UpdateUserCandidatDto
  ) {
    return this.userCandidatsService.updateByCandidateId(
      candidateId,
      updateUserCandidatDto
    );
  }

  async updateRevisionsAndRevisionChanges(
    userId: string,
    opportunityUsers: OpportunityUser[]
  ) {
    const documentIds = [
      userId,
      ...opportunityUsers.map((opportunityUser) => {
        return opportunityUser.id;
      }),
    ];

    const revisions = await this.revisionsService.findAllByDocumentIds(
      documentIds
    );
    await this.revisionChangesService.updateByRevisionIds(
      revisions.map((revision) => {
        return `'${revision.id}'`;
      }),
      {
        document: {},
        diff: [{}],
      }
    );
    await this.revisionsService.updateByDocumentIds(documentIds, {
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
}
