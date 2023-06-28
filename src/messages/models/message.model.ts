import { ApiProperty } from '@nestjs/swagger';
import { IsOptional, IsString } from 'class-validator';
import { IsEmail as IsEmailClassValidator } from 'class-validator/types/decorator/string/IsEmail';
import {
  AllowNull,
  BelongsTo,
  Column,
  CreatedAt,
  DataType,
  Default,
  ForeignKey,
  IsEmail,
  IsUUID,
  Length,
  Model,
  PrimaryKey,
  UpdatedAt,
} from 'sequelize-typescript';
import { User } from 'src/users/models';
import { AdminZone } from 'src/utils/types';

export class Message extends Model {
  @IsUUID(4)
  @PrimaryKey
  @Default(DataType.UUIDV4)
  @Column
  id: string;

  @IsUUID(4)
  @ForeignKey(() => User)
  @AllowNull(false)
  @Column
  UserId: string;

  @ApiProperty()
  @IsString()
  @AllowNull(false)
  @Column
  firstName: string;

  @ApiProperty()
  @IsString()
  @AllowNull(false)
  @Column
  lastName: string;

  @ApiProperty()
  @IsEmailClassValidator()
  @IsEmail
  @AllowNull(false)
  @Column
  email: string;

  @ApiProperty()
  @IsString()
  @IsOptional()
  @AllowNull(true)
  @Length({ min: 0, max: 30 })
  @Column
  phone: string;

  @ApiProperty()
  @IsString()
  @IsOptional()
  @AllowNull(true)
  @Column
  zone: AdminZone;

  @ApiProperty()
  @IsString()
  @AllowNull(false)
  @Column
  subject: string;

  @ApiProperty()
  @IsString()
  @AllowNull(false)
  @Column
  message: string;

  // TODO create Type for type
  @ApiProperty()
  @IsString()
  @IsOptional()
  @AllowNull(true)
  @Column
  type: string;

  @BelongsTo(() => User, 'UserId')
  user: User;

  @CreatedAt
  createdAt: Date;

  @UpdatedAt
  updatedAt: Date;
}
