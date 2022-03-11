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

export const UserRoles = {
  Candidat: 'Candidat',
  Coach: 'Coach',
  Admin: 'Admin',
} as const;
export type UserRole = typeof UserRoles[keyof typeof UserRoles];

const AdminRoles = {
  Candidats: 'Candidats',
  Entreprises: 'Entreprises',
} as const;

type AdminRole = typeof AdminRoles[keyof typeof AdminRoles];

const AdminZones = {
  PARIS: 'PARIS',
  LYON: 'LYON',
  LILLE: 'LILLE',
  HZ: 'HORS ZONE',
} as const;

type AdminZone = typeof AdminZones[keyof typeof AdminZones];

const Genders = {
  Male: 0,
  Female: 1,
} as const;

type Gender = typeof Genders[keyof typeof Genders];

// TODO : paranoid, papertrail

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
  @Default(UserRoles.Candidat)
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
  @Default(Genders.Male)
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
    if (user.role === UserRoles.Candidat) {
      await UserCandidat.create(
        {
          candidatId: user.id,
        },
        { hooks: true },
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
          previousData.role === UserRoles.Candidat &&
          nextData.role !== UserRoles.Candidat
        ) {
          try {
            UserCandidat.destroy({
              where: {
                candidatId: nextData.id,
              },
            });
          } catch (e) {
            console.log('Candidat inexistant');
          }
        } else if (
          previousData.role !== UserRoles.Candidat &&
          nextData.role === UserRoles.Candidat
        ) {
          if (previousData.role === UserRoles.Coach) {
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
        nextData.role === UserRoles.Candidat
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
          [destroyedUser.role === UserRoles.Coach ? 'coachId' : 'candidatId']:
            destroyedUser.id,
        },
      },
    );
  }
}
