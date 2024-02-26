import { ApiProperty } from '@nestjs/swagger';
import { IsString } from 'class-validator';
import {
  AllowNull,
  BelongsTo,
  Column,
  CreatedAt,
  DataType,
  Default,
  ForeignKey,
  IsUUID,
  Model,
  PrimaryKey,
  Table,
  UpdatedAt,
  DeletedAt,
} from 'sequelize-typescript';
import { User } from 'src/users/models';

@Table({ tableName: 'InternalMessages' })
export class InternalMessage extends Model {
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
  senderUserId: string;

  @ApiProperty()
  @IsString()
  @IsUUID(4)
  @ForeignKey(() => User)
  @AllowNull(false)
  @Column
  addresseeUserId: string;

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

  @BelongsTo(() => User, 'senderUserId')
  senderUser: User;

  @BelongsTo(() => User, 'addresseeUserId')
  addresseeUser: User;

  @CreatedAt
  createdAt: Date;

  @UpdatedAt
  updatedAt: Date;

  @DeletedAt
  deletedAt: Date;
}
