import {
  AfterCreate,
  AfterDestroy,
  AllowNull,
  BeforeCreate,
  BeforeUpdate,
  Column,
  Default,
  HasOne,
  IsEmail,
  IsUUID,
  Length,
  Model,
  PrimaryKey,
  Table,
  Unique,
} from 'sequelize-typescript';

import { v4 as uuid } from 'uuid';
import { AdminZone } from 'src/utils/types';
import { UserCandidat } from './user-candidat.model';

export const UserRoles = {
  CANDIDAT: 'Candidat',
  COACH: 'Coach',
  ADMIN: 'Admin',
} as const;
export type UserRole = typeof UserRoles[keyof typeof UserRoles];

export const AdminRoles = {
  CANDIDATS: 'Candidats',
  ENTREPRISES: 'Entreprises',
} as const;

export type AdminRole = typeof AdminRoles[keyof typeof AdminRoles];

const Genders = {
  MALE: 0,
  FEMALE: 1,
} as const;

type Gender = typeof Genders[keyof typeof Genders];

function generateUrl(user: User) {
  return `${user.firstName.toLowerCase()}-${user.id.substring(0, 8)}`;
}

function capitalizeNameAndTrim(name: string) {
  if (!name) {
    // we need to keep its value if its '', null or undefined
    return name;
  }

  let capitalizedName = name
    .toString()
    .toLowerCase()
    .split(' ')
    .map((s) => {
      return s.charAt(0).toUpperCase() + s.substring(1);
    })
    .join(' ');

  capitalizedName = capitalizedName
    .split('-')
    .map((s) => {
      return s.charAt(0).toUpperCase() + s.substring(1);
    })
    .join('-');

  return capitalizedName.trim().replace(/\s\s+/g, ' ');
}

export function getRelatedUser(member: User) {
  if (member) {
    if (member.candidat && member.candidat.coach) {
      return member.candidat.coach;
    }
    if (member.coach && member.coach.candidat) {
      return member.coach.candidat;
    }
  }

  return null;
}

//TODO : paranoid, papertrail

@Table({ tableName: 'Users' })
export class User extends Model {
  @IsUUID(4)
  @PrimaryKey
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

  /*
  @BelongsToMany(() => Opportunity, () => OpportunityUser)
  opportunities: Opportunity[]
  */

  // si candidat regarder candidat
  @HasOne(() => UserCandidat, {
    foreignKey: 'candidatId',
    hooks: true,
    onDelete: 'CASCADE',
  })
  candidat: UserCandidat;

  // si coach regarder coach
  @HasOne(() => UserCandidat, 'coachId')
  coach: UserCandidat;

  @BeforeCreate
  static generateId(user: User) {
    user.id = uuid();
  }

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
      // TODO
      /*await models.Share.create({
        CandidatId: user.id,
      });*/
    }
  }

  @BeforeUpdate
  static async manageRoleChange(nextUser: User) {
    const previousUserValues = nextUser.previous();
    if (nextUser && previousUserValues && previousUserValues.role) {
      if (
        previousUserValues.role === UserRoles.CANDIDAT &&
        nextUser.role !== UserRoles.CANDIDAT
      ) {
        try {
          await UserCandidat.destroy({
            where: {
              candidatId: nextUser.id,
            },
          });
        } catch (e) {
          console.log('Candidat inexistant');
        }
      } else if (
        previousUserValues.role !== UserRoles.CANDIDAT &&
        nextUser.role === UserRoles.CANDIDAT
      ) {
        if (previousUserValues.role === UserRoles.COACH) {
          try {
            await UserCandidat.update(
              {
                coachId: null,
              },
              {
                // TODO check if works
                where: {
                  candidatId: nextUser.previous('coach').candidat.id,
                },
              }
            );
          } catch (e) {
            console.log('Pas de candidat associé');
          }
        }

        try {
          await UserCandidat.create({
            candidatId: nextUser.id,
            url: generateUrl(nextUser),
          });
          // TODO
          /*await models.Share.findOrCreate({
              where: {
                CandidatId: nextUser.id,
              },
            });*/
        } catch (e) {
          console.log(e);
        }
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
      try {
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
      } catch (e) {
        console.log(e);
      }
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
