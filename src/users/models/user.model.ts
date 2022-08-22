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
  Model,
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
import { AdminZone } from 'src/utils/types';
import { UserCandidat } from './user-candidat.model';

//TODO : papertrail

@Table({ tableName: 'Users' })
export class User extends Model {
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
  static async createAssociations(user: User) {
    if (user.role === UserRoles.CANDIDAT) {
      await UserCandidat.create(
        {
          candidatId: user.id,
        },
        { hooks: true }
      );
      await Share.create({
        CandidatId: user.id,
      });
    }
  }

  @BeforeUpdate
  static async manageRoleChange(nextUser: User) {
    const previousUserValues: Partial<User> = nextUser.previous();
    if (nextUser && previousUserValues && previousUserValues.role) {
      if (
        previousUserValues.role === UserRoles.CANDIDAT &&
        nextUser.role !== UserRoles.CANDIDAT
      ) {
        await UserCandidat.destroy({
          where: {
            candidatId: nextUser.id,
          },
        });
      } else if (
        previousUserValues.role !== UserRoles.CANDIDAT &&
        nextUser.role === UserRoles.CANDIDAT
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
            candidatId: nextUser.id,
            url: generateUrl(nextUser),
          },
          { hooks: true }
        );
        await Share.findOrCreate({
          where: {
            CandidatId: nextUser.id,
          },
        });
      }
    }
  }

  @BeforeUpdate
  static async manageNameChange(nextUser: User) {
    const previousUserValues = nextUser.previous();
    if (
      nextUser &&
      previousUserValues &&
      previousUserValues.firstName &&
      nextUser.role === UserRoles.CANDIDAT
    ) {
      await UserCandidat.update(
        {
          url: generateUrl(nextUser),
        },
        {
          where: {
            candidatId: nextUser.id,
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
