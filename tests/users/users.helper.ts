import { Injectable } from '@nestjs/common';
import { AuthService } from 'src/auth/auth.service';
import { UserCandidat, User } from 'src/users/models';
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
    userCandidatProps: Partial<UserCandidat> = {},
    insertInDB = true
  ): Promise<{ user: User; token: string }> {
    const user = await this.userFactory.create(
      props,
      userCandidatProps,
      insertInDB
    );

    const { token } = await this.authService.login(user);

    return {
      user,
      token: token,
    };
  }

  async findUser(userId: string) {
    return this.usersService.findOne(userId);
  }
}
