import { ApiProperty } from '@nestjs/swagger';
import { IsString, IsEmail as IsEmailClassValidator } from 'class-validator';
import {
  AllowNull,
  Column,
  CreatedAt,
  DataType,
  Default,
  IsEmail,
  IsUUID,
  Length,
  Model,
  PrimaryKey,
  UpdatedAt,
} from 'sequelize-typescript';
import { AdminZone } from 'src/utils/types';

export class Organization extends Model {
  @IsUUID(4)
  @PrimaryKey
  @Default(DataType.UUIDV4)
  @Column
  id: string;

  @ApiProperty()
  @IsString()
  @AllowNull(false)
  @Column
  name: string;

  @ApiProperty()
  @IsString()
  @AllowNull(false)
  @Column
  address: string;

  @ApiProperty()
  @IsString()
  @AllowNull(false)
  @Column
  referentFirstName: string;

  @ApiProperty()
  @IsString()
  @AllowNull(false)
  @Column
  referentLastName: string;

  @ApiProperty()
  @IsEmailClassValidator()
  @IsEmail
  @AllowNull(false)
  @Column
  referentMail: string;

  @ApiProperty()
  @IsString()
  @AllowNull(false)
  @Length({ min: 0, max: 30 })
  @Column
  referentPhone: string;

  @ApiProperty()
  @IsString()
  @AllowNull(true)
  @Column
  zone: AdminZone;

  @CreatedAt
  createdAt: Date;

  @UpdatedAt
  updatedAt: Date;
}
