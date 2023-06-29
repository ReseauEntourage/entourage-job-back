import { ApiProperty } from '@nestjs/swagger';
import {
  IsEmail as IsEmailClassValidator,
  IsOptional,
  IsString,
} from 'class-validator';
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
  Table,
  UpdatedAt,
} from 'sequelize-typescript';
import { ContactType } from '../messages.types';
import { User } from 'src/users/models';

@Table({ tableName: 'Messages' })
export class Message extends Model {
  @IsUUID(4)
  @PrimaryKey
  @Default(DataType.UUIDV4)
  @Column
  id: string;

  @ApiProperty()
  @IsString()
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
  @AllowNull(false)
  @Column
  subject: string;

  @ApiProperty()
  @IsString()
  @AllowNull(false)
  @Column
  message: string;

  @ApiProperty()
  @IsString()
  @IsOptional()
  @AllowNull(true)
  @Column
  type: ContactType;

  @BelongsTo(() => User, 'UserId')
  user: User;

  @CreatedAt
  createdAt: Date;

  @UpdatedAt
  updatedAt: Date;
}
