import { ApiProperty } from '@nestjs/swagger';
import { IsNumber } from 'class-validator';
import {
  AllowNull,
  Column,
  DataType,
  Default,
  IsUUID,
  Model,
  PrimaryKey,
  Table,
  CreatedAt,
  UpdatedAt,
} from 'sequelize-typescript';

@Table({ tableName: 'OpportunityUser_StatusChanges' })
export class OpportunityUserStatusChange extends Model {
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

  @IsUUID(4)
  @AllowNull(true)
  @Column
  UserId: string;

  @IsUUID(4)
  @AllowNull(true)
  @Column
  OpportunityId: string;

  @ApiProperty()
  @AllowNull(true)
  @IsNumber()
  @Column
  oldStatus: number;

  @ApiProperty()
  @AllowNull(true)
  @IsNumber()
  @Column
  newStatus: number;

  @CreatedAt
  createdAt: Date;

  @UpdatedAt
  updatedAt: Date;
}
