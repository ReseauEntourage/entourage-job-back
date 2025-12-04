// eslint-disable-next-line import/no-unresolved
import { faker } from '@faker-js/faker';
import { Injectable } from '@nestjs/common';
import { InjectModel } from '@nestjs/sequelize';
import moment from 'moment/moment';
import phone from 'phone';
import { encryptPassword } from 'src/auth/auth.utils';
import { UserProfileWithPartialAssociations } from 'src/user-profiles/models';
import { UserProfilesService } from 'src/user-profiles/user-profiles.service';
import { UserSocialSituationsService } from 'src/user-social-situations/user-social-situations.service';
import { User, UserSocialSituation } from 'src/users/models';
import { UsersService } from 'src/users/users.service';
import { Gender, UserRoles } from 'src/users/users.types';
import { capitalizeNameAndTrim } from 'src/users/users.utils';
import { Factory } from 'src/utils/types';
import { ZoneName } from 'src/utils/types/zones.types';

@Injectable()
export class UserFactory implements Factory<User> {
  constructor(
    @InjectModel(User)
    private userModel: typeof User,
    private usersService: UsersService,
    private userProfilesService: UserProfilesService,
    private userSocialSituationsService: UserSocialSituationsService
  ) {}

  generateUser(props: Partial<User>): Partial<User> {
    const { salt, hash } = encryptPassword(
      props.password || faker.internet.password()
    );

    const fakePhoneNumber = faker.phone.number('+336 ## ## ## ##');

    const fakeData: Partial<User> = {
      email: faker.internet.email().toLowerCase(),
      firstName: capitalizeNameAndTrim(faker.name.firstName()),
      lastName: capitalizeNameAndTrim(faker.name.lastName()),
      role: UserRoles.CANDIDATE,
      gender: faker.helpers.arrayElement([0, 1]) as Gender,
      phone: phone(fakePhoneNumber, { country: 'FRA' }).phoneNumber,
      address: faker.address.streetAddress(),
      lastConnection: new Date(),
      zone: ZoneName.PARIS,
      hashReset: faker.datatype.uuid(),
      saltReset: faker.datatype.uuid(),
      createdAt: moment().toDate(),
      updatedAt: moment().toDate(),
    };

    return {
      ...fakeData,
      ...props,
      password: hash,
      salt,
    };
  }

  async create(
    props: Partial<User> = {},
    userAssociationsProps: {
      userProfile?: UserProfileWithPartialAssociations;
      userSocialCondition?: Partial<UserSocialSituation>;
    } = { userProfile: {}, userSocialCondition: {} },
    insertInDB = true
  ): Promise<User> {
    props.isEmailVerified = true;
    const userData = this.generateUser(props);
    const userId = faker.datatype.uuid();
    if (insertInDB) {
      await this.userModel.create({ ...userData, id: userId }, { hooks: true });
      if (userAssociationsProps?.userProfile) {
        await this.userProfilesService.updateByUserId(userId, {
          ...userAssociationsProps.userProfile,
        });
      }

      if (userAssociationsProps?.userSocialCondition) {
        await this.userSocialSituationsService.createOrUpdateSocialSituation(
          userId,
          userAssociationsProps.userSocialCondition
        );
      }
    }
    const dbUser = await this.usersService.findOne(userData.id || userId);
    if (dbUser) {
      return dbUser.toJSON();
    }
    const builtUser = await this.userModel.build(userData);
    const { id, isEmailVerified, ...builtUserWithoutIdAndIsEmailVerified } =
      builtUser.toJSON();
    return builtUserWithoutIdAndIsEmailVerified as User;
  }

  async delete(userId: string) {
    await this.usersService.update(userId, { deletedAt: new Date() });
  }

  // async createAndDelete(props: Partial<User> = {}) {
  //   const createdUser = await this.create(props);
  //   const deletedUser = await this.usersService.update(createdUser.id, {
  //     deletedAt: new Date(),
  //   });
  //   return deletedUser.toJSON();
  // }
}
