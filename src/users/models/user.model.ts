import {
  AfterCreate,
  AfterDestroy,
  AllowNull,
  BeforeCreate,
  BeforeUpdate,
  Column,
  CreatedAt,
  DataType,
  Default,
  DeletedAt,
  HasOne,
  IsEmail,
  IsUUID,
  Length,
  PrimaryKey,
  Table,
  Unique,
  UpdatedAt,
} from 'sequelize-typescript';

import {
  AdminRole,
  Gender,
  Genders,
  UserRole,
  UserRoles,
} from '../users.types';
import {
  capitalizeNameAndTrim,
  generateUrl,
  getCandidateIdFromCoachOrCandidate,
} from '../users.utils';
import { Share } from 'src/shares/models';
import { AdminZone, HistorizedModel } from 'src/utils/types';
import { UserCandidat } from './user-candidat.model';

//TODO : papertrail

@Table({ tableName: 'Users' })
export class User extends HistorizedModel {
  @IsUUID(4)
  @PrimaryKey
  @Default(DataType.UUIDV4)
  @Column
  id: string;

  @AllowNull(false)
  @Length({ min: 1, max: 40 })
  @Column
  firstName: string;

  @Length({ min: 1, max: 40 })
  @AllowNull(false)
  @Column
  lastName: string;

  @IsEmail
  @AllowNull(false)
  @Unique
  @Column
  email: string;

  @AllowNull(false)
  @Default(UserRoles.CANDIDAT)
  @Column
  role: UserRole;

  @AllowNull(true)
  @Column
  adminRole: AdminRole;

  @AllowNull(false)
  @Column
  password: string; // hash

  @AllowNull(false)
  @Column
  salt: string;

  @AllowNull(false)
  @Default(Genders.MALE)
  @Column
  gender: Gender;

  @AllowNull(true)
  @Length({ min: 0, max: 30 })
  @Column
  phone: string;

  @AllowNull(true)
  @Column
  address: string;

  @AllowNull(true)
  @Column
  lastConnection: Date;

  @AllowNull(true)
  @Column
  hashReset: string;

  @AllowNull(true)
  @Column
  saltReset: string;

  @AllowNull(true)
  @Column
  zone: AdminZone;

  @CreatedAt
  createdAt: Date;

  @UpdatedAt
  updatedAt: Date;

  @DeletedAt
  deletedAt: Date;

  /*
  @BelongsToMany(() => Opportunity, () => OpportunityUser)
  opportunities: Opportunity[]
  */

  // si candidat regarder candidat
  @HasOne(() => UserCandidat, {
    foreignKey: 'candidatId',
    hooks: true,
  })
  candidat: UserCandidat;

  // si coach regarder coach
  @HasOne(() => UserCandidat, 'coachId')
  coach: UserCandidat;

  @BeforeCreate
  @BeforeUpdate
  static trimValues(user: User) {
    const { firstName, lastName, email, role } = user;
    user.role = role || UserRoles.CANDIDAT;
    user.email = email.toLowerCase();
    user.firstName = capitalizeNameAndTrim(firstName);
    user.lastName = capitalizeNameAndTrim(lastName);
  }

  @AfterCreate
  static async createAssociations(createdUser: User) {
    if (createdUser.role === UserRoles.CANDIDAT) {
      await UserCandidat.create(
        {
          candidatId: createdUser.id,
        },
        { hooks: true }
      );
      await Share.create({
        CandidatId: createdUser.id,
      });
    }
  }

  @BeforeUpdate
  static async manageRoleChange(userToUpdate: User) {
    const previousUserValues: Partial<User> = userToUpdate.previous();
    if (userToUpdate && previousUserValues && previousUserValues.role) {
      if (
        previousUserValues.role === UserRoles.CANDIDAT &&
        userToUpdate.role !== UserRoles.CANDIDAT
      ) {
        await UserCandidat.destroy({
          where: {
            candidatId: userToUpdate.id,
          },
        });
      } else if (
        previousUserValues.role !== UserRoles.CANDIDAT &&
        userToUpdate.role === UserRoles.CANDIDAT
      ) {
        if (previousUserValues.role === UserRoles.COACH) {
          await UserCandidat.update(
            {
              coachId: null,
            },
            {
              where: {
                candidatId: getCandidateIdFromCoachOrCandidate(
                  previousUserValues as User
                ),
              },
            }
          );
        }

        await UserCandidat.create(
          {
            candidatId: userToUpdate.id,
            url: generateUrl(userToUpdate),
          },
          { hooks: true }
        );
        await Share.findOrCreate({
          where: {
            CandidatId: userToUpdate.id,
          },
        });
      }
    }
  }

  @BeforeUpdate
  static async manageNameChange(userToUpdate: User) {
    const previousUserValues = userToUpdate.previous();
    if (
      userToUpdate &&
      previousUserValues &&
      previousUserValues.firstName &&
      userToUpdate.role === UserRoles.CANDIDAT
    ) {
      await UserCandidat.update(
        {
          url: generateUrl(userToUpdate),
        },
        {
          where: {
            candidatId: userToUpdate.id,
          },
        }
      );
    }
  }

  @AfterDestroy
  static async unbindCoach(destroyedUser: User) {
    await UserCandidat.update(
      {
        coachId: null,
      },
      {
        where: {
          [destroyedUser.role === UserRoles.COACH ? 'coachId' : 'candidatId']:
            destroyedUser.id,
        },
      }
    );
  }
}
