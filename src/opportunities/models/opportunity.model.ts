import { ApiProperty } from '@nestjs/swagger';
import {
  IsArray,
  IsBoolean,
  IsNumber,
  IsOptional,
  IsString,
} from 'class-validator';
import {
  AllowNull,
  BelongsToMany,
  Column,
  CreatedAt,
  DataType,
  Default,
  HasMany,
  IsUUID,
  Model,
  PrimaryKey,
  Table,
  UpdatedAt,
} from 'sequelize-typescript';
import { ExternalOfferOrigin } from '../opportunities.types';
import { BusinessLine } from 'src/common/businessLines/models';
import { ContractValue } from 'src/common/contracts/contracts.types';
import { Department } from 'src/common/locations/locations.types';
import { User } from 'src/users/models';
import { OpportunityBusinessLine } from './opportunity-businessLine.model';
import { OpportunityUser } from './opportunity-user.model';

@Table({ tableName: 'Opportunities' })
export class Opportunity extends Model {
  @IsUUID(4)
  @PrimaryKey
  @Default(DataType.UUIDV4)
  @Column
  id: string;

  @ApiProperty()
  @IsString()
  @AllowNull(false)
  @Column
  title: string;

  @ApiProperty()
  @IsBoolean()
  @IsOptional()
  @AllowNull(false)
  @Default(true)
  @Column
  isPublic: boolean;

  @ApiProperty()
  @IsBoolean()
  @IsOptional()
  @AllowNull(false)
  @Default(false)
  @Column
  isValidated: boolean;

  @ApiProperty()
  @IsBoolean()
  @IsOptional()
  @AllowNull(false)
  @Default(false)
  @Column
  isArchived: boolean;

  @ApiProperty()
  @IsBoolean()
  @IsOptional()
  @AllowNull(false)
  @Default(false)
  @Column
  isExternal: boolean;

  @ApiProperty()
  @IsString()
  @IsOptional()
  @AllowNull(true)
  @Column
  link: string;

  @ApiProperty()
  @IsString()
  @IsOptional()
  @AllowNull(true)
  @Column
  externalOrigin: ExternalOfferOrigin;

  @ApiProperty()
  @IsString()
  @AllowNull(true)
  @Column
  company: string;

  @ApiProperty()
  @IsString()
  @IsOptional()
  @AllowNull(true)
  @Column
  recruiterName: string;

  @ApiProperty()
  @IsString()
  @IsOptional()
  @AllowNull(true)
  @Column
  recruiterFirstName: string;

  @ApiProperty()
  @IsString()
  @IsOptional()
  @AllowNull(true)
  @Column
  recruiterMail: string;

  @ApiProperty()
  @IsString()
  @IsOptional()
  @AllowNull(true)
  @Column
  contactMail: string;

  @ApiProperty()
  @IsString()
  @IsOptional()
  @AllowNull(true)
  @Column
  recruiterPosition: string;

  @ApiProperty()
  @IsString()
  @IsOptional()
  @AllowNull(true)
  @Column
  recruiterPhone: string;

  @ApiProperty()
  @IsString()
  @IsOptional()
  @AllowNull(false)
  @Default(new Date())
  @Column
  date: Date;

  @ApiProperty()
  @IsString()
  @IsOptional()
  @AllowNull(true)
  @Column
  address: string;

  @ApiProperty()
  @IsString()
  @IsOptional()
  @AllowNull(true)
  @Column
  description: string;

  @ApiProperty()
  @IsString()
  @IsOptional()
  @AllowNull(true)
  @Column
  companyDescription: string;

  @ApiProperty()
  @IsString()
  @IsOptional()
  @AllowNull(true)
  @Column
  skills: string;

  @ApiProperty()
  @IsString()
  @IsOptional()
  @AllowNull(true)
  @Column
  prerequisites: string;

  @ApiProperty()
  @IsString()
  @IsOptional()
  @AllowNull(false)
  @Column
  department: Department;

  @ApiProperty()
  @IsString()
  @AllowNull(true)
  @Column
  contract: ContractValue;

  @ApiProperty()
  @IsString()
  @IsOptional()
  @AllowNull(true)
  @Column(DataType.DATEONLY)
  startOfContract: Date;

  @ApiProperty()
  @IsString()
  @IsOptional()
  @AllowNull(true)
  @Column(DataType.DATEONLY)
  endOfContract: Date;

  @ApiProperty()
  @IsBoolean()
  @IsOptional()
  @AllowNull(false)
  @Default(false)
  @Column
  isPartTime: boolean;

  @ApiProperty()
  @IsNumber()
  @IsOptional()
  @AllowNull(false)
  @Default(1)
  @Column
  numberOfPositions: number;

  @ApiProperty()
  @IsBoolean()
  @IsOptional()
  @AllowNull(false)
  @Default(false)
  @Column
  beContacted: boolean;

  @ApiProperty()
  @IsString()
  @IsOptional()
  @AllowNull(true)
  @Column
  message: string;

  @ApiProperty()
  @IsBoolean()
  @IsOptional()
  @AllowNull(false)
  @Default(false)
  @Column
  driversLicense: boolean;

  @ApiProperty()
  @IsString()
  @IsOptional()
  @AllowNull(true)
  @Column
  workingHours: string;

  @ApiProperty()
  @IsString()
  @IsOptional()
  @AllowNull(true)
  @Column
  salary: string;

  @ApiProperty()
  @IsString()
  @IsOptional()
  @AllowNull(true)
  @Column
  otherInfo: string;

  @IsUUID(4)
  @AllowNull(true)
  @Column
  createdBy: string;

  @CreatedAt
  createdAt: Date;

  @UpdatedAt
  updatedAt: Date;

  @ApiProperty()
  @IsArray()
  @IsOptional()
  @BelongsToMany(
    () => BusinessLine,
    () => OpportunityBusinessLine,
    'OpportunityId',
    'BusinessLineId'
  )
  businessLines: BusinessLine[];

  @BelongsToMany(() => User, () => OpportunityUser, 'OpportunityId', 'UserId')
  users: User[];

  @HasMany(() => OpportunityUser, 'OpportunityId')
  opportunityUsers: OpportunityUser[];
}
