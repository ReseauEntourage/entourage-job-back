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
import { UserCandidat } from './user-candidat.model';
import { AdminZone } from 'src/utils/types/Departments';

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
    const { firstName, lastName, email } = user;
    user.email = email.toLowerCase();
    user.firstName = firstName.trim().replace(/\s\s+/g, ' ');
    user.lastName = lastName.trim().replace(/\s\s+/g, ' ');
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

  /* @BeforeUpdate
  static beforeUpdate(user: User) {
    const nextData = user.dataValues;
    const previousData = user._previousDataValues;
    if (nextData && previousData) {
      if (nextData.role && nextData.role !== previousData.role) {
        if (
          previousData.role === UserRoles.CANDIDAT &&
          nextData.role !== UserRoles.CANDIDAT
        ) {
          try {
            UserCandidat.destroy({
              where: {
                candidatId: nextData.id,
              },
            });
          } catch (e) {
            console.log('CANDIDAT inexistant');
          }
        } else if (
          previousData.role !== UserRoles.CANDIDAT &&
          nextData.role === UserRoles.CANDIDAT
        ) {
          if (previousData.role === UserRoles.COACH) {
            try {
              // TODO
              /!* await UserCandidat.update(
                {
                  coachId: null,
                },
                {
                  where: {
                    candidatId: previousData.coach.candidat.id,
                  },
                },
              );*!/
            } catch (e) {
              console.log('Pas de candidat associé');
            }
          }

          try {
            // TODO
            /!* await UserCandidat.create({
              candidatId: nextData.id,
              url: generateUrl(nextData),
            });*!/
            // TODO
            /!*await models.Share.findOrCreate({
              where: {
                CandidatId: nextData.id,
              },
            });*!/
          } catch (e) {
            console.log(e);
          }
        }
      }
      if (
        nextData.firstName !== previousData.firstName &&
        nextData.role === UserRoles.CANDIDAT
      ) {
        try {
          // TODO
          /!*await UserCandidat.update(
            {
              url: generateUrl(nextData),
            },
            {
              where: {
                candidatId: nextData.id,
              },
            },
          );*!/
        } catch (e) {
          console.log(e);
        }
      }
    }
  }*/

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
