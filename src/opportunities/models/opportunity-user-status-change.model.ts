import { ApiProperty } from '@nestjs/swagger';
import { IsString, IsNumber } from 'class-validator';
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
} from 'sequelize-typescript';
import { OpportunityUser } from './opportunity-user.model';

@Table({ tableName: 'OpportunityUser_StatusChange' })
export class OpportunityUser_StatusChange extends Model {
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
  Opportunity_UserId: string;

  @IsString()
  @Column(DataType.DATEONLY)
  createdAt: Date;

  @ApiProperty()
  @AllowNull(true)
  @IsNumber()
  @Column
  oldStatus: number;

  @ApiProperty()
  @IsNumber()
  @Column
  newStatus: number;
}
