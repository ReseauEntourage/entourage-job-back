import { Injectable } from '@nestjs/common';
import { InjectModel } from '@nestjs/sequelize';
import { AuthService } from 'src/auth';
import { User, UserCandidat } from 'src/users';
import { UserFactory } from './user.factory';

@Injectable()
export class UserCandidatHelper {
  constructor(
    private authService: AuthService,
    private userFactory: UserFactory,
    @InjectModel(UserCandidat)
    private userCandidatModel: typeof UserCandidat
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
  }

  async getCandidatUrl(id: string) {
    const userCandidat = await this.userCandidatModel.findOne({
      where: { candidatId: id },
      attributes: ['url'],
    });
    const { url } = userCandidat.toJSON();
    return url;
  }
}
