import { ApiProperty } from '@nestjs/swagger';
import {
  IsArray,
  IsBoolean,
  IsDate,
  IsEnum,
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
import { BusinessSector } from 'src/common/business-sectors/models';
import { Language } from 'src/common/languages/models';
import { Department } from 'src/common/locations/locations.types';
import { Occupation } from 'src/common/occupations/models';
import { User } from 'src/users/models';
import { getZoneFromDepartment } from 'src/utils/misc';
import { HelpNeed } from './help-need.model';
import { HelpOffer } from './help-offer.model';
import { UserProfileBusinessSector } from './user-profile-business-sector.model';
import { UserProfileLanguage } from './user-profile-language.model';
import { UserProfileOccupation } from './user-profile-occupation.model';

const LINKEDIN_URL_REGEX = new RegExp('linkedin\\.com');

export enum UnavailabilityReason {
  NO_MORE_TIME = 'no_more_time',
  VACATION = 'vacation',
  ALREADY_FULL = 'already_full',
  NO_MORE_HELP = 'no_more_help',
  OTHER_SUPPORT = 'other_support',
}

@Table({ tableName: 'UserProfiles' })
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
  userId: string;

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

  @ApiProperty({ enum: UnavailabilityReason })
  @IsEnum(UnavailabilityReason)
  @AllowNull(true)
  @Column
  unavailabilityReason: UnavailabilityReason;

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
  @IsBoolean()
  @Default(false)
  @Column
  hasPicture: boolean;

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

  @BelongsTo(() => User, 'userId')
  user: User;

  @ApiProperty()
  @IsArray()
  @IsOptional()
  @BelongsToMany(
    () => BusinessSector,
    () => UserProfileBusinessSector,
    'userProfileId',
    'businessSectorId'
  )
  businessSectors: BusinessSector[];

  @HasMany(() => UserProfileBusinessSector, 'userProfileId')
  userProfileBusinessSectors: UserProfileBusinessSector[];

  @ApiProperty()
  @IsArray()
  @IsOptional()
  @BelongsToMany(
    () => Occupation,
    () => UserProfileOccupation,
    'userProfileId',
    'occupationId'
  )
  occupations: Occupation[];

  @HasMany(() => UserProfileOccupation, 'userProfileId')
  userProfileOccupations: UserProfileOccupation[];

  @ApiProperty()
  @IsArray()
  @IsOptional()
  @BelongsToMany(
    () => Language,
    () => UserProfileLanguage,
    'userProfileId',
    'languageId'
  )
  languages: Language[];

  @HasMany(() => UserProfileLanguage, 'userProfileId')
  userProfileLanguages: UserProfileLanguage[];

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
            id: updatedUserProfile.userId,
          },
          ...(options?.transaction ? { transaction: options.transaction } : {}),
        }
      );
    }
  }
}
