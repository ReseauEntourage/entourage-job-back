import { ApiProperty } from '@nestjs/swagger';
import { IsString } from 'class-validator';
import {
  AllowNull,
  BelongsTo,
  Column,
  DataType,
  Default,
  ForeignKey,
  IsUUID,
  PrimaryKey,
  Table,
  Model,
} from 'sequelize-typescript';
import { DocumentsTypes } from '../read-documents.types';
import { User } from 'src/users/models';

@Table({ tableName: 'ReadDocuments' })
export class ReadDocuments extends Model {
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

  @AllowNull(false)
  @Column
  documentName: DocumentsTypes;

  @BelongsTo(() => User, 'UserId')
  user: User;
}
