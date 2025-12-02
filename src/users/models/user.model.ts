import { ApiProperty } from '@nestjs/swagger';
import {
  IsBoolean,
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
  Gender,
  Genders,
  RolesWithOrganization,
  UserRole,
  UserRoles,
} from '../users.types';
import {
  capitalizeNameAndTrim,
  generateUrl,
  isRoleIncluded,
} from '../users.utils';
import { CompanyInvitation } from 'src/companies/models/company-invitation.model';
import { CompanyUser } from 'src/companies/models/company-user.model';
import { Company } from 'src/companies/models/company.model';
import { Conversation, ConversationParticipant } from 'src/messaging/models';
import { Organization } from 'src/organizations/models';
import { ReadDocument } from 'src/read-documents/models';
import { UserProfile } from 'src/user-profiles/models';
import { UserSocialSituation } from 'src/user-social-situations/models/user-social-situation.model';
import {
  WhatsappCandidateByZone,
  WhatsappCoachByZone,
} from 'src/utils/constants/whatsapp-groups';
import { Zones } from 'src/utils/constants/zones';
import { HistorizedModel } from 'src/utils/types';
import {
  InternalStaffContact,
  StaffContactGroup,
  ZoneName,
} from 'src/utils/types/zones.types';
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
  @IsOptional()
  @IsUUID(4)
  @ForeignKey(() => User)
  @AllowNull(true)
  @Column
  refererId: string;

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
  @IsEmailClassValidator({
    blacklisted_chars: '"\'`$&*()=[]{};:<>?,\\^',
    allow_utf8_local_part: false,
  })
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
  @Default(Genders.OTHER)
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
  zone: ZoneName;

  @ApiProperty()
  @IsBoolean()
  @Column
  isEmailVerified: boolean;

  @CreatedAt
  createdAt: Date;

  @UpdatedAt
  updatedAt: Date;

  @DeletedAt
  deletedAt: Date;

  @Column(DataType.VIRTUAL)
  get whatsappZoneName(): string {
    const zone = this.getDataValue('zone') as ZoneName;
    const isCoach = this.getDataValue('role') === UserRoles.COACH;
    if (!zone) {
      return '';
    }
    return isCoach
      ? WhatsappCoachByZone[zone].name
      : WhatsappCandidateByZone[zone].name;
  }

  @Column(DataType.VIRTUAL)
  get whatsappZoneUrl(): string {
    const zone = this.getDataValue('zone') as ZoneName;
    const isCoach = this.getDataValue('role') === UserRoles.COACH;
    if (!zone) {
      return '';
    }
    return isCoach
      ? WhatsappCoachByZone[zone].url || ''
      : WhatsappCandidateByZone[zone].url || '';
  }

  /**
   * Get the staff contact information based on the user's zone and company admin status
   * Requires 'zone' and 'role' to be set on the User instance and 'company' to be loaded if applicable
   * @returns StaffContact information or undefined if zone is invalid
   */
  @Column(DataType.VIRTUAL)
  get staffContact(): InternalStaffContact | undefined {
    const zone = (this.getDataValue('zone') as ZoneName) || ZoneName.HZ;

    // Check if companies association is loaded
    const hasCompanies = this.companies !== undefined;
    const staffContactGroup =
      hasCompanies && this.company && this.company?.companyUser?.isAdmin
        ? StaffContactGroup.COMPANY
        : StaffContactGroup.MAIN;

    if (!(zone in Zones)) {
      return undefined;
    }
    return Zones[zone].staffContact[staffContactGroup];
  }

  @Column(DataType.VIRTUAL)
  get whatsappZoneQR(): string {
    const zone = this.getDataValue('zone') as ZoneName;
    const isCoach = this.getDataValue('role') === UserRoles.COACH;
    if (!zone) {
      return '';
    }
    return isCoach
      ? WhatsappCoachByZone[zone].qr
      : WhatsappCandidateByZone[zone].qr;
  }

  // si candidat regarder candidat
  @HasOne(() => UserCandidat, {
    foreignKey: 'candidatId',
    hooks: true,
  })
  candidat?: UserCandidat;

  @HasOne(() => UserSocialSituation, {
    foreignKey: 'userId',
    hooks: true,
  })
  userSocialSituation?: UserSocialSituation;

  @BelongsTo(() => Organization, 'OrganizationId')
  organization?: Organization;

  @BelongsTo(() => User, 'refererId')
  referer?: User;

  @HasOne(() => UserProfile, {
    foreignKey: 'userId',
    hooks: true,
  })
  userProfile: UserProfile;

  @HasMany(() => ReadDocument, 'UserId')
  readDocuments: ReadDocument[];

  @BelongsToMany(() => Conversation, {
    through: () => ConversationParticipant,
    foreignKey: 'userId',
    otherKey: 'conversationId',
  })
  conversations: Conversation[];

  @HasMany(() => User, 'refererId')
  referredCandidates: User[];

  @HasMany(() => CompanyUser)
  companyUsers: CompanyUser[];

  companyUser: CompanyUser;

  @BelongsToMany(() => Company, {
    through: () => CompanyUser,
    foreignKey: 'userId',
    otherKey: 'companyId',
    as: 'companies',
  })
  companies: Company[];

  @Column({
    type: DataType.VIRTUAL,
    get(this: User) {
      return this.companies && this.companies.length > 0
        ? this.companies[0]
        : null;
    },
  })
  company: Company | null;

  @HasMany(() => CompanyInvitation, {
    foreignKey: 'userId',
    as: 'invitations',
  })
  companyInvitations: CompanyInvitation[];

  toJSON() {
    const attributes = this.get({ plain: true });
    // Remove companies and add company
    const { companies, ...rest } = attributes;
    return {
      ...rest,
      company:
        this.companies && this.companies.length > 0 ? this.companies[0] : null,
    };
  }

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
    }
    await UserProfile.create(
      {
        userId: createdUser.id,
      },
      { hooks: true }
    );
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
      }

      if (
        isRoleIncluded(RolesWithOrganization, previousUserValues.role) &&
        !isRoleIncluded(RolesWithOrganization, userToUpdate.role)
      ) {
        await User.update(
          {
            OrganizationId: null,
          },
          {
            where: {
              id: userToUpdate.id,
            },
          }
        );
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
