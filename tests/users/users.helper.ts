import { Injectable } from '@nestjs/common';
import { AuthService } from 'src/auth/auth.service';
import {
  CurrentUserDto,
  generateCurrentUserDto,
} from 'src/auth/dto/current-user.dto';
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
  ): Promise<{ user: CurrentUserDto; token: string }> {
    props.isEmailVerified = true;
    const { id } = await this.userFactory.create(
      props,
      userAssociationsProps,
      insertInDB
    );

    const user = await this.authService.findOneUserById(id);
    const userProfile = await this.authService.findOneUserProfileById(
      id,
      false
    );
    const userHasCurrentUserDto = generateCurrentUserDto(user, userProfile);

    const { token } = await this.authService.login(userHasCurrentUserDto);

    return {
      user: userHasCurrentUserDto,
      token: token,
    };
  }

  async findUser(userId: string): Promise<User> {
    const user = await this.usersService.findOne(userId);
    return user?.toJSON();
  }

  // async updateUser(userId: string, props: UpdateUserDto): Promise<User> {
  //   const updatedUser = await this.usersService.update(userId, props);
  //   return updatedUser?.toJSON();
  // }
}
