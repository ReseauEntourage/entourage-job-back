import { Injectable } from '@nestjs/common';
import { AuthService } from 'src/auth/auth.service';
import { UserProfile } from 'src/user-profiles/models';
import { UpdateUserDto } from 'src/users/dto';
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

  async updateUser(userId: string, props: UpdateUserDto): Promise<User> {
    const user = await this.usersService.update(userId, props);
    return user?.toJSON();
  }

  async findUser(userId: string): Promise<User> {
    const user = await this.usersService.findOne(userId);
    return user?.toJSON();
  }
}
