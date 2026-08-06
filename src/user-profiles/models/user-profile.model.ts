import { ApiProperty } from '@nestjs/swagger';
import {
  IsArray,
  IsBoolean,
  IsDate,
  IsEnum,
  IsOptional,
  IsString,
  Matches,
  MaxLength,
} from 'class-validator';
import { Op, Transaction } from 'sequelize';
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
import { BusinessSector } from 'src/business-sectors/models';
import { Review } from 'src/common/reviews/models';
import { Contract } from 'src/contracts/models';
import { Experience } from 'src/experiences/models';
import { Formation } from 'src/formations/models';
import { Interest } from 'src/interests/models';
import { Language } from 'src/languages/models';
import type { Department } from 'src/locations/locations.types';
import { Nudge } from 'src/nudge/models';
import { Occupation } from 'src/occupations/models';
import { Skill } from 'src/skills/models';
import { User } from 'src/users/models';
import { getZoneNameFromDepartment } from 'src/utils/misc';
import { UserProfileContract } from './user-profile-contract.model';
import { UserProfileEmbedding } from './user-profile-embedding.model';
import { UserProfileLanguage } from './user-profile-language.model';
import { UserProfileNudge } from './user-profile-nudge.model';
import { UserProfileSectorOccupation } from './user-profile-sector-occupation.model';
import { UserProfileSkill } from './user-profile-skill.model';

const LINKEDIN_URL_REGEX = new RegExp('linkedin\\.com');

export enum UnavailabilityReason {
  ALREADY_FULL = 'already_full',
  INACTIVITY = 'inactivity',
  NO_MORE_HELP = 'no_more_help',
  NO_MORE_TIME = 'no_more_time',
  OTHER_SUPPORT = 'other_support',
  VACATION = 'vacation',
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
  @MaxLength(1000)
  @AllowNull(true)
  @Column
  description: string;

  @ApiProperty()
  @AllowNull(true)
  @Column
  unavailableAt: Date;

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
  @IsBoolean()
  @Default(false)
  @Column
  optInNewsletter: boolean;

  @ApiProperty()
  @IsBoolean()
  @Default(true)
  @Column
  optInRecommendations: boolean;

  @ApiProperty()
  @IsString()
  @AllowNull(true)
  @Column
  department: Department;

  @IsDate()
  @AllowNull(true)
  @Column
  lastRecommendationsDate: Date;

  @IsDate()
  @AllowNull(true)
  @Column
  embeddingPendingAt: Date;

  @CreatedAt
  createdAt: Date;

  @UpdatedAt
  updatedAt: Date;

  @DeletedAt
  deletedAt: Date;

  @ApiProperty()
  @IsBoolean()
  @AllowNull(false)
  @Default(true)
  @Column
  allowPhysicalEvents: boolean;

  @ApiProperty()
  @IsBoolean()
  @AllowNull(false)
  @Default(true)
  @Column
  allowRemoteEvents: boolean;

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

  @ApiProperty()
  @IsArray()
  @IsOptional()
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

  @ApiProperty()
  @IsArray()
  @IsOptional()
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
  @HasMany(() => Experience, 'userProfileId')
  experiences: Experience[];

  // Formations
  @ApiProperty()
  @IsArray()
  @IsOptional()
  @HasMany(() => Formation, 'userProfileId')
  formations: Formation[];

  // Reviews
  @ApiProperty()
  @IsArray()
  @IsOptional()
  @HasMany(() => Review, 'userProfileId')
  reviews: Review[];

  // Interests
  @ApiProperty()
  @IsArray()
  @IsOptional()
  @HasMany(() => Interest, 'userProfileId')
  interests: Interest[];

  // Nudges
  @ApiProperty()
  @IsArray()
  @IsOptional()
  @BelongsToMany(
    () => Nudge,
    () => UserProfileNudge,
    'userProfileId',
    'nudgeId'
  )
  nudges: Nudge[];

  @HasMany(() => UserProfileNudge, 'userProfileId')
  userProfileNudges: UserProfileNudge[];

  // Custom Nudges
  @ApiProperty()
  @IsArray()
  @IsOptional()
  @HasMany(() => UserProfileNudge, {
    foreignKey: 'userProfileId',
    scope: {
      content: {
        [Op.ne]: null,
      },
      nudgeId: {
        [Op.eq]: null,
      },
    },
    as: 'customNudges',
  })
  customNudges: UserProfileNudge[];

  // Embeddings
  @ApiProperty()
  @IsArray()
  @IsOptional()
  @HasMany(() => UserProfileEmbedding, 'userProfileId')
  embeddings: UserProfileEmbedding[];

  /**
   * Hooks
   */
  @AfterUpdate
  static async updateZone(
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
          zone: getZoneNameFromDepartment(updatedUserProfile.department),
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

export type UserProfileSectorOccupationWithPartialAssociations = Partial<
  Omit<UserProfileSectorOccupation, 'businessSector' | 'occupation'> & {
    businessSector?: Partial<BusinessSector>;
    occupation?: Partial<Occupation>;
  }
>;

export type UserProfileWithPartialAssociations = Partial<
  Omit<
    UserProfile,
    | 'sectorOccupations'
    | 'nudges'
    | 'experiences'
    | 'formations'
    | 'contracts'
    | 'skills'
    | 'userProfileLanguages'
    | 'interests'
    | 'customNudges'
    | 'reviews'
  >
> & {
  contracts?: Partial<Contract>[];
  customNudges?: Partial<UserProfileNudge>[];
  experiences?: Partial<Experience>[];
  formations?: Partial<Formation>[];
  interests?: Partial<Interest>[];
  nudges?: Partial<Nudge>[];
  reviews?: Partial<Review>[];
  sectorOccupations?: Partial<UserProfileSectorOccupationWithPartialAssociations>[];
  skills?: Partial<Skill>[];
  userProfileLanguages?: Partial<UserProfileLanguage>[];
};
