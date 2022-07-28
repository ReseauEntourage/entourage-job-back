import { Injectable } from '@nestjs/common';
import { AuthService } from 'src/auth';
import { User, UserCandidat } from 'src/users';
import { UserFactory } from './user.factory';

@Injectable()
export class UserCandidatHelper {
  constructor(
    private authService: AuthService,
    private userFactory: UserFactory
  ) {}

  async associateCoachAndCandidat(
    coach: User,
    candidat: User,
    isLogged = false
  ) {
    const coachCredentials = isLogged
      ? { user: coach }
      : await this.authService.login(coach);
    const candidatCredentials = isLogged
      ? { user: candidat }
      : await this.authService.login(candidat);

    await UserCandidat.update(
      {
        candidatId: candidatCredentials.user.id,
        coachId: coachCredentials.user.id,
      },
      {
        where: { candidatId: candidatCredentials.user.id },
        individualHooks: true,
      }
    );
  }

  async getCandidatUrl(id: string) {
    const userCandidat = await UserCandidat.findOne({
      where: { candidatId: id },
      attributes: ['url'],
    });
    const { url } = userCandidat.toJSON();
    return url;
  }
}
