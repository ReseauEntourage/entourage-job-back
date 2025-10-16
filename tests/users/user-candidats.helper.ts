import { Injectable } from '@nestjs/common';
import { InjectModel } from '@nestjs/sequelize';
import { AuthService } from 'src/auth/auth.service';
import { UserCandidat } from 'src/users/models';
import { UserCandidatsService } from 'src/users/user-candidats.service';
import { UserFactory } from './user.factory';
import { UsersHelper } from './users.helper';

@Injectable()
export class UserCandidatsHelper {
  constructor(
    @InjectModel(UserCandidat)
    private userCandidatModel: typeof UserCandidat,
    private userCandidatsService: UserCandidatsService,
    private authService: AuthService,
    private usersHelper: UsersHelper,
    private userFactory: UserFactory
  ) {}

  async findOneUserCandidat({
    candidateId,
    coachId,
  }: {
    candidateId?: string;
    coachId?: string;
  }) {
    return this.userCandidatsService.findOneByCandidateOrCoachId(
      candidateId,
      coachId
    );
  }

  async findAllUserCandidatsById(usersIds: string[]): Promise<UserCandidat[]> {
    return this.userCandidatsService.findAllById(usersIds);
  }

  async setLastModifiedBy(candidateId: string, userId: string | null) {
    return this.userCandidatsService.updateByCandidateId(candidateId, {
      lastModifiedBy: userId,
    });
  }

  async getCandidatUrl(candidateId: string) {
    const userCandidat = await this.userCandidatsService.findOneByCandidateId(
      candidateId
    );
    const { url } = userCandidat;
    return url;
  }
}
