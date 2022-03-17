import { Injectable } from '@nestjs/common';
import { AuthService } from '../../src/auth/auth.service';
import { InjectModel } from '@nestjs/sequelize';
import { AdminZones, User, UserRoles } from '../../src/users/models/user.model';
import { UserCandidat } from '../../src/users/models/user-candidat.model';
import { faker } from '@faker-js/faker';
import { UsersService } from '../../src/users/users.service';

@Injectable()
export class UserFactory {
  constructor(
    @InjectModel(User)
    private userModel: User,
    @InjectModel(UserCandidat)
    private userCandidatModel: UserCandidat,
    private authService: AuthService,
    private usersService: UsersService,
  ) {}

  /**
   * Generate an oject which contains the data necessary
   * to build a user.
   * @param {Object} props Properties to use to create User
   * @return An object to build the user from.
   */
  generateData(props: Partial<User>): Partial<User> {
    const { salt, hash } = this.authService.encryptPassword(
      props.password ? props.password : faker.internet.password(),
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
      lastConnection: props.lastConnection || faker.date.past(),
      zone: props.zone || AdminZones.PARIS,
      hashReset: props.hashReset || faker.datatype.uuid(),
      saltReset: props.saltReset || faker.datatype.uuid(),
      coach: null,
      candidat: null,
    } as User;
  }

  /**
   * Create a User in DB.
   * @param {Object} props Properties to use to create User
   * @param {Object} userCandidatProps Properties to use to create UserCandidat association
   * @param {boolean} insertInDB @default true
   * @return {Promise<User>} a user model,
   * @optional if no DB insertion @returns generated user data
   */
  async create(
    props: Partial<User> = {},
    userCandidatProps: Partial<UserCandidat> = {},
    insertInDB = true,
  ) {
    const userData = await this.generateData(props);

    if (insertInDB) {
      await this.usersService.create(userData);
      await UserCandidat.update(
        { ...userCandidatProps },
        {
          where: {
            candidatId: userData.id,
          },
          individualHooks: true,
        },
      );
      return this.usersService.findOneByMail(userData.email);
    }
    return User.build(userData);
  }
}
