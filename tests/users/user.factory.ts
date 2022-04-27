// eslint-disable-next-line import/no-unresolved
import faker from '@faker-js/faker';
import { Injectable } from '@nestjs/common';
import { InjectModel } from '@nestjs/sequelize';
import { AuthService } from 'src/auth/auth.service';
import { UserCandidat, AdminZones, User, UserRoles } from 'src/users';
import { UsersService } from 'src/users/users.service';

@Injectable()
export class UserFactory {
  constructor(
    @InjectModel(User)
    private userModel: typeof User,
    @InjectModel(UserCandidat)
    private userCandidatModel: typeof UserCandidat,
    private authService: AuthService,
    private usersService: UsersService
  ) {}

  generateData(props: Partial<User>): Partial<User> {
    const { salt, hash } = this.authService.encryptPassword(
      props.password ? props.password : faker.internet.password()
    );

    return {
      id: faker.datatype.uuid(),
      email: props.email || faker.internet.email().toLowerCase(),
      firstName: props.firstName || faker.name.firstName(),
      lastName: props.lastName || faker.name.lastName(),
      role: props.role || UserRoles.CANDIDAT,
      adminRole: props.adminRole || null,
      password: hash,
      gender: props.gender || faker.random.arrayElement([0, 1]),
      salt,
      phone: props.phone || faker.phone.phoneNumber(),
      address: props.address || faker.address.streetAddress(),
      lastConnection: props.lastConnection || new Date(),
      zone: props.zone || AdminZones.PARIS,
      hashReset: props.hashReset || faker.datatype.uuid(),
      saltReset: props.saltReset || faker.datatype.uuid(),
      coach: null,
      candidat: null,
    };
  }

  async create(
    props: Partial<User> = {},
    userCandidatProps: Partial<UserCandidat> = {},
    insertInDB = true
  ): Promise<User> {
    const userData = await this.generateData(props);

    if (insertInDB) {
      await this.usersService.create(userData);
      await this.userCandidatModel.update(
        { ...userCandidatProps },
        {
          where: {
            candidatId: userData.id,
          },
          individualHooks: true,
        }
      );
      const createdUser = await this.usersService.findOne(userData.id);
      return createdUser.toJSON();
    }
    const builtUser = await this.userModel.build(userData);
    return builtUser.toJSON();
  }
}
