import { ApiProperty } from '@nestjs/swagger';
import {
  IsEmail as IsEmailClassValidator,
  IsNumber,
  IsOptional,
  IsString,
} from 'class-validator';
import {
  AfterCreate,
  AfterDestroy,
  AllowNull,
  BeforeCreate,
  BeforeUpdate,
  BelongsTo,
  BelongsToMany,
  Column,
  CreatedAt,
  DataType,
  Default,
  DeletedAt,
  ForeignKey,
  HasMany,
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
  CandidateUserRoles,
  CoachUserRoles,
  Gender,
  Genders,
  UserRole,
  UserRoles,
} from '../users.types';
import {
  areRolesIncluded,
  capitalizeNameAndTrim,
  generateUrl,
} from '../users.utils';
import { Opportunity, OpportunityUser } from 'src/opportunities/models';
import { Organization } from 'src/organizations/models';
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
  @IsString()
  @IsOptional()
  @IsUUID(4)
  @ForeignKey(() => Organization)
  @AllowNull(true)
  @Column
  OrganizationId: string;

  @ApiProperty()
  @IsString()
  @AllowNull(false)
  @Length({ min: 1, max: 40 })
  @Column
  firstName: string;

  @ApiProperty()
  @IsString()
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
  @IsString()
  @AllowNull(false)
  @Default(UserRoles.CANDIDATE)
  @Column
  role: UserRole;

  @ApiProperty()
  @IsString()
  @IsOptional()
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
  @IsNumber()
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
  @IsOptional()
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
  @IsString()
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
  candidat?: UserCandidat;

  // si coach regarder coach
  @HasMany(() => UserCandidat, 'coachId')
  coaches: UserCandidat[];

  @BelongsTo(() => Organization, 'OrganizationId')
  organization?: Organization;

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
    if (areRolesIncluded(CandidateUserRoles, [createdUser.role])) {
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
        areRolesIncluded(CandidateUserRoles, [previousUserValues.role]) &&
        !areRolesIncluded(CandidateUserRoles, [userToUpdate.role])
      ) {
        await UserCandidat.destroy({
          where: {
            candidatId: userToUpdate.id,
          },
        });
      } else if (
        !areRolesIncluded(CandidateUserRoles, [previousUserValues.role]) &&
        areRolesIncluded(CandidateUserRoles, [userToUpdate.role])
      ) {
        if (areRolesIncluded(CoachUserRoles, [previousUserValues.role])) {
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
          hooks: true,
        });
      }
    }
  }

  @BeforeUpdate
  static async manageNameChange(userToUpdate: User) {
    const previousUserValues = userToUpdate.previous();
    if (
      userToUpdate &&
      areRolesIncluded(CandidateUserRoles, [userToUpdate.role]) &&
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
          [areRolesIncluded(CoachUserRoles, [destroyedUser.role])
            ? 'coachId'
            : 'candidatId']: destroyedUser.id,
        },
      }
    );
  }
}
