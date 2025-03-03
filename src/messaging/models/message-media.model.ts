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
} from 'sequelize-typescript';
import { Media } from 'src/medias/models';
import { Message } from './message.model';

@Table({ tableName: 'MessageMedias' })
export class MessageMedia extends Model {
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
  @IsUUID(4)
  @ForeignKey(() => Message)
  @AllowNull(false)
  @Column
  messageId: string;

  @ApiProperty()
  @IsString()
  @IsUUID(4)
  @ForeignKey(() => Media)
  @AllowNull(false)
  @Column
  mediaId: string;

  @BelongsTo(() => Message, 'messageId')
  message: Message;

  @BelongsTo(() => Media, 'mediaId')
  media: Media;
}
