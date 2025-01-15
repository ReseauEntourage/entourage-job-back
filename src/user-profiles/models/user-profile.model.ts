import { ApiProperty } from '@nestjs/swagger';
import {
  IsArray,
  IsBoolean,
  IsDate,
  IsOptional,
  IsString,
  Matches,
} from 'class-validator';
import { Transaction } from 'sequelize';
import {
  AfterUpdate,
  AllowNull,
  BelongsTo,
  BelongsToMany,
  Column,
  CreatedAt,
  DataType,
  Default,
  DeletedAt,
  ForeignKey,
  HasMany,
  IsUUID,
  Model,
  PrimaryKey,
  Table,
  UpdatedAt,
} from 'sequelize-typescript';
import { Ambition } from 'src/common/ambitions/models';
import { BusinessLine } from 'src/common/business-lines/models';
import { Department } from 'src/common/locations/locations.types';
import { User } from 'src/users/models';
import { getZoneFromDepartment } from 'src/utils/misc';
import { HelpNeed } from './help-need.model';
import { HelpOffer } from './help-offer.model';
import { UserProfileNetworkBusinessLine } from './user-profile-network-business-line.model';
import { UserProfileSearchAmbition } from './user-profile-search-ambition.model';
import { UserProfileSearchBusinessLine } from './user-profile-search-business-line.model';

const LINKEDIN_URL_REGEX = new RegExp('linkedin\\.com');

@Table({ tableName: 'User_Profiles' })
export class UserProfile extends Model {
  @IsUUID(4)
  @PrimaryKey
  @Default(DataType.UUIDV4)
  @Column
  id: string;

  @ApiProperty()
  @IsUUID(4)
  @ForeignKey(() => User)
  @AllowNull(false)
  @Column
  UserId: string;

  @ApiProperty()
  @IsString()
  @AllowNull(true)
  @Column
  description: string;

  @ApiProperty()
  @IsBoolean()
  @AllowNull(false)
  @Default(true)
  @Column
  isAvailable: boolean;

  @ApiProperty()
  @IsString()
  @AllowNull(true)
  @Column
  unavailabilityReason: string;

  @ApiProperty()
  @IsString()
  @AllowNull(true)
  @Column
  currentJob: string;

  @ApiProperty()
  @IsString()
  @AllowNull(true)
  @Matches(LINKEDIN_URL_REGEX)
  @Column
  linkedinUrl: string;

  @ApiProperty()
  @IsBoolean()
  @Default(false)
  @Column
  hasExternalCv: boolean;

  @ApiProperty()
  @IsString()
  @AllowNull(true)
  @Column
  department: Department;

  @IsDate()
  @AllowNull(true)
  @Column
  lastRecommendationsDate: Date;

  @CreatedAt
  createdAt: Date;

  @UpdatedAt
  updatedAt: Date;

  @DeletedAt
  deletedAt: Date;

  @BelongsTo(() => User, 'UserId')
  user: User;

  @ApiProperty()
  @IsArray()
  @IsOptional()
  @BelongsToMany(
    () => BusinessLine,
    () => UserProfileNetworkBusinessLine,
    'UserProfileId',
    'BusinessLineId'
  )
  networkBusinessLines: BusinessLine[];

  @HasMany(() => UserProfileNetworkBusinessLine, 'UserProfileId')
  userProfileNetworkBusinessLines: UserProfileNetworkBusinessLine[];

  @ApiProperty()
  @IsArray()
  @IsOptional()
  @BelongsToMany(
    () => BusinessLine,
    () => UserProfileSearchBusinessLine,
    'UserProfileId',
    'BusinessLineId'
  )
  searchBusinessLines: BusinessLine[];

  @HasMany(() => UserProfileSearchBusinessLine, 'UserProfileId')
  userProfileSearchBusinessLines: UserProfileSearchBusinessLine[];

  @ApiProperty()
  @IsArray()
  @IsOptional()
  @BelongsToMany(
    () => Ambition,
    () => UserProfileSearchAmbition,
    'UserProfileId',
    'AmbitionId'
  )
  searchAmbitions: Ambition[];

  @HasMany(() => UserProfileSearchAmbition, 'UserProfileId')
  userProfileSearchAmbitions: UserProfileSearchAmbition[];

  @ApiProperty()
  @IsArray()
  @IsOptional()
  @HasMany(() => HelpNeed, 'UserProfileId')
  helpNeeds: HelpNeed[];

  @ApiProperty()
  @IsArray()
  @IsOptional()
  @HasMany(() => HelpOffer, 'UserProfileId')
  helpOffers: HelpOffer[];

  @AfterUpdate
  static async updateAdminZone(
    updatedUserProfile: UserProfile,
    options: { transaction: Transaction }
  ) {
    const previousDepartment: Department =
      updatedUserProfile.previous('department');

    if (
      updatedUserProfile &&
      updatedUserProfile.department &&
      previousDepartment !== updatedUserProfile.department
    ) {
      await User.update(
        {
          zone: getZoneFromDepartment(updatedUserProfile.department),
        },
        {
          where: {
            id: updatedUserProfile.UserId,
          },
          ...(options?.transaction ? { transaction: options.transaction } : {}),
        }
      );
    }
  }
}
