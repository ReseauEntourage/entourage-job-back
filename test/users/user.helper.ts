import { User } from '../../src/users/models/user.model';
import { UserCandidat } from '../../src/users/models/user-candidat.model';
import { InjectModel } from '@nestjs/sequelize';
import { AuthService } from '../../src/auth/auth.service';
import { UserFactory } from './user.factory';

export class UserHelper {
  constructor(
    @InjectModel(User)
    private userModel: User,
    @InjectModel(UserCandidat)
    private userCandidatModel: UserCandidat,
    private authService: AuthService,
    private userFactory: UserFactory,
  ) {}

  /**
   * Create a user and/or get associated token
   * @param {Object} props Properties to use to create User
   * @param {Object} userCandidatProps Properties to use to create UserCandidat association
   * @param {boolean} insertInDB @default true
   * @optional if no DB insertion @returns generated user data
   */
  async createLoggedInUser(
    props: Partial<User> = {},
    userCandidatProps: Partial<UserCandidat> = {},
    insertInDB = true,
  ) {
    const user = await this.userFactory.create(
      props,
      userCandidatProps,
      insertInDB,
    );

    const { token } = await this.authService.login(user);

    return {
      user,
      token,
    };
  }
}
