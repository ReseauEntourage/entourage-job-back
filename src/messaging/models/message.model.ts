import { ApiProperty } from '@nestjs/swagger';
import { IsString, MaxLength, MinLength } from 'class-validator';
import {
  AllowNull,
  BelongsTo,
  BelongsToMany,
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
import { User } from 'src/users/models';
import { Conversation } from './conversation.model';
import { MessageMedia } from './message-media.model';

@Table({ tableName: 'Messages' })
export class Message extends Model {
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
  @MinLength(1)
  @MaxLength(12000)
  @Column
  content: string;

  @ApiProperty()
  @IsString()
  @IsUUID(4)
  @ForeignKey(() => User)
  @AllowNull(false)
  @Column
  authorId: string;

  @ApiProperty()
  @IsString()
  @IsUUID(4)
  @ForeignKey(() => Conversation)
  @AllowNull(false)
  @Column
  conversationId: string;

  @BelongsTo(() => User, 'authorId')
  author: User;

  @BelongsTo(() => Conversation, 'conversationId')
  conversation: Conversation;

  @BelongsToMany(() => Media, () => MessageMedia, 'messageId', 'mediaId')
  medias: Media[];
}
