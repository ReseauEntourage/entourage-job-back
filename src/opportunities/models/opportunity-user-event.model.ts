import { ApiProperty } from '@nestjs/swagger';
import { IsOptional, IsString } from 'class-validator';
import {
  AllowNull,
  BelongsTo,
  Column,
  CreatedAt,
  DataType,
  Default,
  IsUUID,
  Model,
  PrimaryKey,
  Table,
  UpdatedAt,
} from 'sequelize-typescript';
import { EventType } from '../opportunities.types';
import { Contract } from 'src/common/contracts/models';
import { OpportunityUser } from './opportunity-user.model';

@Table({ tableName: 'OpportunityUser_Events' })
export class OpportunityUserEvent extends Model {
  @IsUUID(4)
  @PrimaryKey
  @Default(DataType.UUIDV4)
  @Column
  id: string;

  @ApiProperty()
  @IsUUID(4)
  @AllowNull(true)
  @Column
  OpportunityUserId: string;

  @ApiProperty()
  @IsUUID(4)
  @AllowNull(true)
  @Column
  ContractId?: string;

  @ApiProperty()
  @AllowNull(true)
  @IsString()
  @Column
  type: EventType;

  @ApiProperty()
  @AllowNull(false)
  @IsString()
  @Column
  startDate: Date;

  @ApiProperty()
  @AllowNull(true)
  @IsString()
  @IsOptional()
  @Column
  endDate: Date;

  @ApiProperty()
  @IsOptional()
  @BelongsTo(() => Contract, 'ContractId')
  contract: Contract;

  @BelongsTo(() => OpportunityUser, 'OpportunityUserId')
  opportunityUser: OpportunityUser;

  @CreatedAt
  createdAt: Date;

  @UpdatedAt
  updatedAt: Date;
}
