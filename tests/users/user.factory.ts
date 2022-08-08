// eslint-disable-next-line import/no-unresolved
import faker from '@faker-js/faker';
import { Injectable } from '@nestjs/common';
import { InjectModel } from '@nestjs/sequelize';
import phone from 'phone';
import { encryptPassword } from 'src/auth/auth.service';
import { UserCandidat, User, UserRoles } from 'src/users';
import { UsersService } from 'src/users/users.service';
import { AdminZones } from 'src/utils/types';

@Injectable()
export class UserFactory {
  constructor(
    @InjectModel(User)
    private userModel: typeof User,
    @InjectModel(UserCandidat)
    private userCandidatModel: typeof UserCandidat,
    private usersService: UsersService
  ) {}

  generateUser(props: Partial<User>): Partial<User> {
    const { salt, hash } = encryptPassword(
      props.password ? props.password : faker.internet.password()
    );

    const fakePhoneNumber = faker.phone.phoneNumber('+336 ## ## ## ##');

    return {
      id: props.id || faker.datatype.uuid(),
      email: props.email || faker.internet.email().toLowerCase(),
      firstName: props.firstName || faker.name.firstName(),
      lastName: props.lastName || faker.name.lastName(),
      role: props.role || UserRoles.CANDIDAT,
      password: hash,
      gender: props.gender || faker.random.arrayElement([0, 1]),
      salt,
      phone:
        props.phone || phone(fakePhoneNumber, { country: 'FRA' }).phoneNumber,
      address: props.address || faker.address.streetAddress(),
      lastConnection: props.lastConnection || new Date(),
      zone: props.zone || AdminZones.PARIS,
      hashReset: props.hashReset || faker.datatype.uuid(),
      saltReset: props.saltReset || faker.datatype.uuid(),
      coach: props.coach,
      candidat: props.candidat,
    };
  }

  async create(
    props: Partial<User> = {},
    userCandidatProps: Partial<UserCandidat> = {},
    insertInDB = true
  ): Promise<User> {
    const userData = await this.generateUser(props);

    if (insertInDB) {
      await this.userModel.create(userData, { hooks: true });
      await this.userCandidatModel.update(
        { ...userCandidatProps },
        {
          where: {
            candidatId: userData.id,
          },
          individualHooks: true,
        }
      );
    }
    const dbUser = await this.usersService.findOne(userData.id);
    if (dbUser) {
      return dbUser.toJSON();
    }
    const builtUser = await this.userModel.build(userData);
    return builtUser.toJSON();
  }
}
