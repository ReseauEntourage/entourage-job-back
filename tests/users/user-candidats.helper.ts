import { Injectable } from '@nestjs/common';
import { InjectModel } from '@nestjs/sequelize';
import { AuthService } from 'src/auth/auth.service';
import { LoggedUser } from 'src/auth/auth.types';
import { User, UserCandidat } from 'src/users/models';
import { UserCandidatsService } from 'src/users/user-candidats.service';
import { UsersHelper } from './users.helper';

@Injectable()
export class UserCandidatsHelper {
  constructor(
    @InjectModel(UserCandidat)
    private userCandidatModel: typeof UserCandidat,
    private userCandidatsService: UserCandidatsService,
    private authService: AuthService,
    private userHelper: UsersHelper
  ) {}

  async associateCoachAndCandidat(
    coach: User | LoggedUser,
    candidat: User | LoggedUser,
    isLogged = false
  ) {
    const coachCredentials: Pick<LoggedUser, 'user'> = isLogged
      ? { user: (coach as LoggedUser).user }
      : await this.authService.login(coach as User);
    const candidatCredentials: Pick<LoggedUser, 'user'> = isLogged
      ? { user: (candidat as LoggedUser).user }
      : await this.authService.login(candidat as User);

    await this.userCandidatModel.update(
      {
        candidatId: candidatCredentials.user.id,
        coachId: coachCredentials.user.id,
      },
      {
        where: { candidatId: candidatCredentials.user.id },
        individualHooks: true,
      }
    );
    if (isLogged) {
      return {
        loggedInCoach: await this.userHelper.createLoggedInUser(
          (coach as LoggedUser).user,
          {},
          false
        ),
        loggedInCandidat: await this.userHelper.createLoggedInUser(
          (candidat as LoggedUser).user,
          {},
          false
        ),
      };
    }
  }

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

  async setLastModifiedBy(candidateId: string, userId: string | null) {
    return this.userCandidatsService.updateByCandidateId(candidateId, {
      lastModifiedBy: userId,
    });
  }
}
