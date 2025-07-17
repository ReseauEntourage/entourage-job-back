import { ApiProperty } from '@nestjs/swagger';
import { IsString } from 'class-validator';
import {
  AllowNull,
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

@Table({ tableName: 'Companies' })
export class Company extends Model {
  @IsUUID(4)
  @PrimaryKey
  @Default(DataType.UUIDV4)
  @Column
  id: string;

  @CreatedAt
  createdAt: Date;

  @UpdatedAt
  updatedAt: Date;

  @ApiProperty()
  @IsString()
  @AllowNull(false)
  @Column
  name: string;

  @ApiProperty()
  @IsString()
  @AllowNull(true)
  @Column
  description: string;

  @ApiProperty()
  @IsString()
  @AllowNull(true)
  @Column
  city: string;

  @ApiProperty()
  @IsString()
  @AllowNull(true)
  @Column
  url: string;

  @ApiProperty()
  @IsString()
  @AllowNull(true)
  @Column
  hiringUrl: string;

  @ApiProperty()
  @IsString()
  @AllowNull(true)
  @Column
  linkedInUrl: string;
}
