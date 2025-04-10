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
import { Contract } from 'src/common/contracts/models';
import { Experience } from 'src/common/experiences/models';
import { Formation } from 'src/common/formations/models';
import { Language } from 'src/common/languages/models';
import { Department } from 'src/common/locations/locations.types';
import { Occupation } from 'src/common/occupations/models';
import { Review } from 'src/common/reviews/models';
import { Skill } from 'src/common/skills/models';
import { User } from 'src/users/models';
import { getZoneFromDepartment } from 'src/utils/misc';
import { HelpNeed } from './help-need.model';
import { HelpOffer } from './help-offer.model';
import { UserProfileContract } from './user-profile-contract.model';
import { UserProfileExperience } from './user-profile-experience.model';
import { UserProfileFormation } from './user-profile-formation.model';
import { UserProfileLanguage } from './user-profile-language.model';
import { UserProfileSectorOccupation } from './user-profile-sector-occupation.model';
import { UserProfileSkill } from './user-profile-skill.model';

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
  @IsString()
  @AllowNull(true)
  @Column
  story: string;

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

  // Business Sectors & Occupations
  @ApiProperty()
  @IsArray()
  @IsOptional()
  @BelongsToMany(
    () => BusinessSector,
    () => UserProfileSectorOccupation,
    'userProfileId',
    'businessSectorId'
  )
  businessSectors: BusinessSector[];

  @ApiProperty()
  @IsArray()
  @IsOptional()
  @BelongsToMany(
    () => Occupation,
    () => UserProfileSectorOccupation,
    'userProfileId',
    'occupationId'
  )
  occupations: Occupation[];

  @HasMany(() => UserProfileSectorOccupation, 'userProfileId')
  sectorOccupations: UserProfileSectorOccupation[];

  // Languages
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

  // Contracts
  @ApiProperty()
  @IsArray()
  @IsOptional()
  @BelongsToMany(
    () => Contract,
    () => UserProfileContract,
    'userProfileId',
    'contractId'
  )
  contracts: Contract[];

  @HasMany(() => UserProfileContract, 'userProfileId')
  userProfileContracts: UserProfileContract[];

  // Skills
  @ApiProperty()
  @IsArray()
  @IsOptional()
  @BelongsToMany(
    () => Skill,
    () => UserProfileSkill,
    'userProfileId',
    'skillId'
  )
  skills: Skill[];

  @HasMany(() => UserProfileSkill, 'userProfileId')
  userProfileSkills: UserProfileSkill[];

  // Experiences
  @ApiProperty()
  @IsArray()
  @IsOptional()
  @BelongsToMany(
    () => Experience,
    () => UserProfileExperience,
    'userProfileId',
    'experienceId'
  )
  experiences: Experience[];

  @HasMany(() => UserProfileExperience, 'userProfileId')
  userProfileExperiences: UserProfileExperience[];

  // Formations
  @ApiProperty()
  @IsArray()
  @IsOptional()
  @BelongsToMany(
    () => Formation,
    () => UserProfileFormation,
    'userProfileId',
    'formationId'
  )
  formations: Formation[];

  @HasMany(() => UserProfileFormation, 'userProfileId')
  userProfileFormations: UserProfileFormation[];

  // Reviews
  @HasMany(() => Review, 'userProfileId')
  reviews: Review[];

  // Helps Needs
  @ApiProperty()
  @IsArray()
  @IsOptional()
  @HasMany(() => HelpNeed, 'UserProfileId')
  helpNeeds: HelpNeed[];

  // Helps Offers
  @ApiProperty()
  @IsArray()
  @IsOptional()
  @HasMany(() => HelpOffer, 'UserProfileId')
  helpOffers: HelpOffer[];

  /**
   * Hooks
   */

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
