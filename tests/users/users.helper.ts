import { Injectable } from '@nestjs/common';
import { AuthService } from 'src/auth/auth.service';
import { UserProfileWithPartialAssociations } from 'src/user-profiles/models';
// import { UpdateUserDto } from 'src/users/dto';
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
      userProfile?: UserProfileWithPartialAssociations;
    } = { userCandidat: {}, userProfile: {} },
    insertInDB = true
  ): Promise<{ user: User; token: string }> {
    props.isEmailVerified = true;
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

  async findUser(userId: string, complete = false): Promise<User> {
    const user = await this.usersService.findOne(userId, complete);
    return user?.toJSON();
  }

  // async updateUser(userId: string, props: UpdateUserDto): Promise<User> {
  //   const updatedUser = await this.usersService.update(userId, props);
  //   return updatedUser?.toJSON();
  // }
}
