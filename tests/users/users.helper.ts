import { Injectable } from '@nestjs/common';
import { AuthService } from 'src/auth/auth.service';
import { UserProfile } from 'src/user-profiles/models';
import { User, UserCandidat } from 'src/users/models';
import { UsersService } from 'src/users/users.service';
import { UserFactory } from './user.factory';

@Injectable()
export class UsersHelper {
  constructor(
    private authService: AuthService,
    private usersService: UsersService,
    private userFactory: UserFactory
  ) {}

  async createLoggedInUser(
    props: Partial<User> = {},
    userAssociationsProps: {
      userCandidat?: Partial<UserCandidat>;
      userProfile?: Partial<UserProfile>;
    } = { userCandidat: {}, userProfile: {} },
    insertInDB = true
  ): Promise<{ user: User; token: string }> {
    const user = await this.userFactory.create(
      props,
      userAssociationsProps,
      insertInDB
    );

    const { token } = await this.authService.login(user);

    return {
      user,
      token: token,
    };
  }

  async findUser(userId: string): Promise<User> {
    const user = await this.usersService.findOne(userId);
    return user?.toJSON();
  }

  mapUserProfileFromUser(user: User): Partial<UserProfile> {
    return {
      id: user.userProfile.id,
      description: user.userProfile.description,
      currentJob: user.userProfile.currentJob,
      /*networkBusinessLines: expect.arrayContaining(
        user.userProfile.networkBusinessLines.map(({ name }) =>
          expect.objectContaining({
            name,
          })
        )
      ),
      searchBusinessLines: expect.arrayContaining(
        user.userProfile.searchBusinessLines.map(({ name }) =>
          expect.objectContaining({
            name,
          })
        )
      ),
      searchAmbitions: expect.arrayContaining(
        user.userProfile.searchAmbitions.map(({ name }) =>
          expect.objectContaining({
            name,
          })
        )
      ),
      helpNeeds: expect.arrayContaining(
        user.userProfile.helpNeeds.map(({ name }) =>
          expect.objectContaining({
            name,
          })
        )
      ),
      helpOffers: expect.arrayContaining(
        user.userProfile.helpOffers.map(({ name }) =>
          expect.objectContaining({
            name,
          })
        )
      ),*/
      user: {
        firstName: user.firstName,
        lastName: user.lastName,
        id: user.id,
        role: user.role,
        zone: user.zone,
      },
    } as Partial<UserProfile>;
  }
}
