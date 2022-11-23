import { ApiProperty } from '@nestjs/swagger';
import { IsNumber } from 'class-validator';
import {
  AllowNull,
  Column,
  DataType,
  Default,
  ForeignKey,
  IsUUID,
  Model,
  PrimaryKey,
  Table,
  CreatedAt,
  UpdatedAt,
} from 'sequelize-typescript';
import { OpportunityUser } from './opportunity-user.model';

@Table({ tableName: 'OpportunityUser_StatusChanges' })
export class OpportunityUserStatusChange extends Model {
  @IsUUID(4)
  @PrimaryKey
  @Default(DataType.UUIDV4)
  @Column
  id: string;

  @ApiProperty()
  @IsUUID(4)
  @ForeignKey(() => OpportunityUser)
  @AllowNull(false)
  @Column
  OpportunityUserId: string;

  @ApiProperty()
  @AllowNull(true)
  @IsNumber()
  @Column
  oldStatus: number;

  @ApiProperty()
  @IsNumber()
  @Column
  newStatus: number;

  @CreatedAt
  createdAt: Date;

  @UpdatedAt
  updatedAt: Date;
}
