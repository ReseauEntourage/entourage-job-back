import { Injectable } from '@nestjs/common';
import { InjectModel } from '@nestjs/sequelize';
import { AuthService } from 'src/auth/auth.service';
import { LoggedUser } from 'src/auth/auth.types';
import { User, UserCandidat } from 'src/users/models';
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

  async associateCoachAndCandidate(
    coach: User | LoggedUser,
    candidate: User | LoggedUser,
    isLogged = false
  ) {
    const coachCredentials: Pick<LoggedUser, 'user'> = isLogged
      ? { user: (coach as LoggedUser).user }
      : await this.authService.login(coach as User);
    const candidateCredentials: Pick<LoggedUser, 'user'> = isLogged
      ? { user: (candidate as LoggedUser).user }
      : await this.authService.login(candidate as User);

    await this.userCandidatModel.update(
      {
        candidatId: candidateCredentials.user.id,
        coachId: coachCredentials.user.id,
      },
      {
        where: { candidatId: candidateCredentials.user.id },
        individualHooks: true,
      }
    );
    if (isLogged) {
      return {
        loggedInCoach: await this.usersHelper.createLoggedInUser(
          (coach as LoggedUser).user as User,
          {},
          false
        ),
        loggedInCandidate: await this.usersHelper.createLoggedInUser(
          (candidate as LoggedUser).user as User,
          {},
          false
        ),
      };
    }
    return {
      coach: await this.userFactory.create(coach as User, {}, false),
      candidate: await this.userFactory.create(candidate as User, {}, false),
    };
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
