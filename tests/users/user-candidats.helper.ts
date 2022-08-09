import { Injectable } from '@nestjs/common';
import { InjectModel } from '@nestjs/sequelize';
import { AuthService } from 'src/auth/auth.service';
import { User, UserCandidat } from 'src/users/models';

@Injectable()
export class UserCandidatsHelper {
  constructor(
    @InjectModel(UserCandidat)
    private userCandidatModel: typeof UserCandidat,
    private authService: AuthService
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
}
