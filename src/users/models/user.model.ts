import { ApiProperty } from '@nestjs/swagger';
import { IsEmail as IsEmailClassValidator, IsString } from 'class-validator';
import {
  AfterCreate,
  AfterDestroy,
  AllowNull,
  BeforeCreate,
  BeforeUpdate,
  BelongsToMany,
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
import { capitalizeNameAndTrim, generateUrl } from '../users.utils';
import { Opportunity, OpportunityUser } from 'src/opportunities/models';
import { Share } from 'src/shares/models';
import { AdminZone, HistorizedModel } from 'src/utils/types';
import { UserCandidat } from './user-candidat.model';

@Table({ tableName: 'Users' })
export class User extends HistorizedModel {
  @IsUUID(4)
  @PrimaryKey
  @Default(DataType.UUIDV4)
  @Column
  id: string;

  @ApiProperty()
  @AllowNull(false)
  @Length({ min: 1, max: 40 })
  @Column
  firstName: string;

  @ApiProperty()
  @Length({ min: 1, max: 40 })
  @AllowNull(false)
  @Column
  lastName: string;

  @ApiProperty()
  @IsEmailClassValidator()
  @IsEmail
  @AllowNull(false)
  @Unique
  @Column
  email: string;

  @ApiProperty()
  @AllowNull(false)
  @Default(UserRoles.CANDIDATE)
  @Column
  role: UserRole;

  @ApiProperty()
  @AllowNull(true)
  @Column
  adminRole: AdminRole;

  @ApiProperty()
  @AllowNull(false)
  @Column
  password: string; // hash

  @ApiProperty()
  @AllowNull(false)
  @Column
  salt: string;

  @ApiProperty()
  @AllowNull(false)
  @Default(Genders.MALE)
  @Column
  gender: Gender;

  @ApiProperty()
  @IsString()
  @AllowNull(true)
  @Length({ min: 0, max: 30 })
  @Column
  phone: string;

  @ApiProperty()
  @IsString()
  @AllowNull(true)
  @Column
  address: string;

  @ApiProperty()
  @AllowNull(true)
  @Column
  lastConnection: Date;

  @ApiProperty()
  @AllowNull(true)
  @Column
  hashReset: string;

  @ApiProperty()
  @AllowNull(true)
  @Column
  saltReset: string;

  @ApiProperty()
  @AllowNull(true)
  @Column
  zone: AdminZone;

  @CreatedAt
  createdAt: Date;

  @UpdatedAt
  updatedAt: Date;

  @DeletedAt
  deletedAt: Date;

  @BelongsToMany(
    () => Opportunity,
    () => OpportunityUser,
    'UserId',
    'OpportunityId'
  )
  opportunities: Opportunity[];

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
    user.role = role || UserRoles.CANDIDATE;
    user.email = email.toLowerCase();
    user.firstName = capitalizeNameAndTrim(firstName);
    user.lastName = capitalizeNameAndTrim(lastName);
  }

  @AfterCreate
  static async createAssociations(createdUser: User) {
    if (createdUser.role === UserRoles.CANDIDATE) {
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
    if (
      userToUpdate &&
      userToUpdate.role &&
      previousUserValues &&
      previousUserValues.role !== undefined &&
      previousUserValues.role !== userToUpdate.role
    ) {
      if (
        previousUserValues.role === UserRoles.CANDIDATE &&
        userToUpdate.role !== UserRoles.CANDIDATE
      ) {
        await UserCandidat.destroy({
          where: {
            candidatId: userToUpdate.id,
          },
        });
      } else if (
        previousUserValues.role !== UserRoles.CANDIDATE &&
        userToUpdate.role === UserRoles.CANDIDATE
      ) {
        if (previousUserValues.role === UserRoles.COACH) {
          await UserCandidat.update(
            {
              coachId: null,
            },
            {
              where: {
                coachId: userToUpdate.id,
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
      userToUpdate.role === UserRoles.CANDIDATE &&
      previousUserValues &&
      previousUserValues.firstName != undefined &&
      previousUserValues.firstName !== userToUpdate.firstName
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
