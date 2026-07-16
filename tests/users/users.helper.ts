import { Injectable } from '@nestjs/common';
import { InjectModel } from '@nestjs/sequelize';
import { AuthService } from 'src/auth/auth.service';
import {
  CurrentUserDto,
  generateCurrentUserDto,
} from 'src/auth/dto/current-user.dto';
import { UserProfileWithPartialAssociations } from 'src/user-profiles/models';
// import { UpdateUserDto } from 'src/users/dto';
import { User } from 'src/users/models';
import { UsersService } from 'src/users/users.service';
import { UserFactory } from './user.factory';

export type LoggedInUser = { token: string; user: CurrentUserDto };

@Injectable()
export class UsersHelper {
  constructor(
    private authService: AuthService,
    private usersService: UsersService,
    private userFactory: UserFactory,
    @InjectModel(User)
    private userModel: typeof User
  ) {}

  async createLoggedInUser(
    props: Partial<User> = {},
    userAssociationsProps: {
      userProfile?: UserProfileWithPartialAssociations;
    } = { userProfile: {} },
    insertInDB = true
  ): Promise<LoggedInUser> {
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

    const { token } = await this.authService.login(userHasCurrentUserDto.id);

    // login() sets lastConnection to now as a side effect; restore the intended value if explicitly provided
    if (props.lastConnection !== undefined) {
      await this.usersService.update(id, {
        lastConnection: props.lastConnection,
      });
    }

    return {
      user: userHasCurrentUserDto,
      token: token,
    };
  }

  async findUser(userId: string): Promise<User> {
    const user = await this.usersService.findOneWithRelations(userId);
    return user?.toJSON();
  }

  // Reads the raw row with all columns, unlike findUser which is limited to UserAttributes
  async findUserRaw(userId: string): Promise<User | undefined> {
    const user = await this.userModel.findByPk(userId);
    return user?.toJSON();
  }
}
