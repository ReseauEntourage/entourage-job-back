// eslint-disable-next-line import/no-unresolved
import faker from '@faker-js/faker';
import { Injectable } from '@nestjs/common';
import { InjectModel } from '@nestjs/sequelize';
import moment from 'moment/moment';
import phone from 'phone';
import { encryptPassword } from 'src/auth/auth.utils';
import { UserProfile } from 'src/user-profiles/models';
import { User, UserCandidat } from 'src/users/models';
import { UsersService } from 'src/users/users.service';
import { Gender, UserRoles } from 'src/users/users.types';
import { capitalizeNameAndTrim } from 'src/users/users.utils';
import { AdminZones, Factory } from 'src/utils/types';

@Injectable()
export class UserFactory implements Factory<User> {
  constructor(
    @InjectModel(User)
    private userModel: typeof User,
    @InjectModel(UserCandidat)
    private userCandidatModel: typeof UserCandidat,
    @InjectModel(UserProfile)
    private userProfileModel: typeof UserProfile,
    private usersService: UsersService
  ) {}

  generateUser(props: Partial<User>): Partial<User> {
    const { salt, hash } = encryptPassword(
      props.password || faker.internet.password()
    );

    const fakePhoneNumber = faker.phone.phoneNumber('+336 ## ## ## ##');

    const fakeData: Partial<User> = {
      email: faker.internet.email().toLowerCase(),
      firstName: capitalizeNameAndTrim(faker.name.firstName()),
      lastName: capitalizeNameAndTrim(faker.name.lastName()),
      role: UserRoles.CANDIDATE,
      gender: faker.random.arrayElement([0, 1]) as Gender,
      phone: phone(fakePhoneNumber, { country: 'FRA' }).phoneNumber,
      address: faker.address.streetAddress(),
      lastConnection: new Date(),
      zone: AdminZones.PARIS,
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
      userCandidat?: Partial<UserCandidat>;
      userProfile?: Partial<UserProfile>;
    } = { userCandidat: {}, userProfile: {} },
    insertInDB = true
  ): Promise<User> {
    const userData = this.generateUser(props);
    const userId = faker.datatype.uuid();
    if (insertInDB) {
      await this.userModel.create({ ...userData, id: userId }, { hooks: true });
      await this.userCandidatModel.update(
        { ...userAssociationsProps.userCandidat },
        {
          where: {
            candidatId: userId,
          },
          individualHooks: true,
        }
      );
      await this.userProfileModel.update(
        { ...userAssociationsProps.userProfile },
        {
          where: {
            UserId: userId,
          },
          individualHooks: true,
        }
      );
    }
    const dbUser = await this.usersService.findOne(userData.id || userId);
    if (dbUser) {
      return dbUser.toJSON();
    }
    const builtUser = await this.userModel.build(userData);
    const { id, ...builtUserWithoutId } = builtUser.toJSON();
    return builtUserWithoutId as User;
  }
}
