import { ApiProperty } from '@nestjs/swagger';
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
import { BusinessLine } from 'src/businessLines/models';
import { ContractValue } from 'src/contracts/contracts.types';
import { Department } from 'src/locations/locations.types';
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
  @AllowNull(false)
  @Column
  title: string;

  @ApiProperty()
  @Default(true)
  @Column
  isPublic: boolean;

  @ApiProperty()
  @Default(false)
  @Column
  isValidated: boolean;

  @ApiProperty()
  @Default(false)
  @Column
  isArchived: boolean;

  @ApiProperty()
  @Default(false)
  @Column
  isExternal: boolean;

  @ApiProperty()
  @AllowNull(true)
  @Column
  link: string;

  @ApiProperty()
  @AllowNull(true)
  @Column
  externalOrigin: ExternalOfferOrigin;

  @ApiProperty()
  @AllowNull(true)
  @Column
  company: string;

  @ApiProperty()
  @AllowNull(true)
  @Column
  recruiterName: string;

  @ApiProperty()
  @AllowNull(true)
  @Column
  recruiterFirstName: string;

  @ApiProperty()
  @AllowNull(true)
  @Column
  contactMail: string;

  @ApiProperty()
  @AllowNull(true)
  @Column
  recruiterPosition: string;

  @ApiProperty()
  @AllowNull(true)
  @Column
  recruiterPhone: string;

  @ApiProperty()
  @AllowNull(false)
  @Default(new Date())
  @Column
  date: Date;

  @ApiProperty()
  @AllowNull(true)
  @Column
  address: string;

  @ApiProperty()
  @AllowNull(true)
  @Column
  description: string;

  @ApiProperty()
  @AllowNull(true)
  @Column
  companyDescription: string;

  @ApiProperty()
  @AllowNull(true)
  @Column
  skills: string;

  @ApiProperty()
  @AllowNull(true)
  @Column
  prerequisites: string;

  @ApiProperty()
  @AllowNull(false)
  @Column
  department: Department;

  @ApiProperty()
  @AllowNull(true)
  @Column
  contract: ContractValue;

  @ApiProperty()
  @AllowNull(true)
  @Column
  startOfContract: Date;

  @ApiProperty()
  @AllowNull(true)
  @Column
  endOfContract: Date;

  @ApiProperty()
  @AllowNull(false)
  @Default(false)
  @Column
  isPartTime: boolean;

  @ApiProperty()
  @AllowNull(false)
  @Default(1)
  @Column
  numberOfPositions: number;

  @ApiProperty()
  @AllowNull(false)
  @Default(false)
  @Column
  beContacted: boolean;

  @ApiProperty()
  @AllowNull(true)
  @Column
  message: string;

  @ApiProperty()
  @AllowNull(false)
  @Default(false)
  @Column
  driversLicense: boolean;

  @ApiProperty()
  @AllowNull(true)
  @Column
  workingHours: string;

  @ApiProperty()
  @AllowNull(true)
  @Column
  salary: string;

  @ApiProperty()
  @AllowNull(true)
  @Column
  otherInfo: string;

  @ApiProperty()
  @IsUUID(4)
  @AllowNull(true)
  @Column
  createdBy: string;

  @CreatedAt
  createdAt: Date;

  @UpdatedAt
  updatedAt: Date;

  @ApiProperty()
  @BelongsToMany(
    () => BusinessLine,
    () => OpportunityBusinessLine,
    'OpportunityId',
    'BusinessLineId'
  )
  businessLines: BusinessLine[];

  @ApiProperty()
  @BelongsToMany(() => User, () => OpportunityUser, 'OpportunityId', 'UserId')
  users: User[];

  @HasMany(() => OpportunityUser, 'CVId')
  opportunityUsers: OpportunityUser[];
}
