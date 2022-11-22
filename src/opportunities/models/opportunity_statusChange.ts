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

@Table({ tableName: 'Opportunity_StatusChange' })
export class Opportunity_statusChange extends Model {
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
  Opportunity_UsersId: string;

  @IsString()
  @AllowNull(true)
  @Column(DataType.DATEONLY)
  updatedAt: Date;

  @ApiProperty()
  @IsNumber()
  @Column
  oldStatus: number;

  @ApiProperty()
  @IsNumber()
  @Column
  newStatus: number;

}