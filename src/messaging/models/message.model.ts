import { ApiProperty } from '@nestjs/swagger';
import { IsOptional, IsString, MaxLength } from 'class-validator';
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

export enum MessageType {
  SERVICE = 'SERVICE',
  USER = 'USER',
}

// Discriminant for `type: SERVICE` messages, so consumers know how to interpret `metadata`.
export enum ServiceMessageKind {
  CHECKIN_NOTE = 'CHECKIN_NOTE',
}

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
  @MaxLength(12000)
  @Column
  content: string;

  // Null only for `type: SERVICE` messages (see messaging-core-conversations capability).
  @ApiProperty()
  @IsOptional()
  @IsString()
  @IsUUID(4)
  @ForeignKey(() => User)
  @AllowNull(true)
  @Column
  authorId: string;

  @ApiProperty()
  @IsString()
  @IsUUID(4)
  @ForeignKey(() => Conversation)
  @AllowNull(false)
  @Column
  conversationId: string;

  @ApiProperty()
  @IsString()
  @Default(MessageType.USER)
  @Column(DataType.STRING)
  type: MessageType;

  // Only set for `type: SERVICE` messages.
  @ApiProperty()
  @IsOptional()
  @IsString()
  @AllowNull(true)
  @Column(DataType.STRING)
  serviceMessageKind: ServiceMessageKind;

  // Only set for `type: SERVICE` messages, payload specific to `serviceMessageKind`.
  @ApiProperty()
  @IsOptional()
  @AllowNull(true)
  @Column(DataType.JSONB)
  metadata: Record<string, unknown>;

  @BelongsTo(() => User, 'authorId')
  author: User;

  @BelongsTo(() => Conversation, 'conversationId')
  conversation: Conversation;

  @BelongsToMany(() => Media, () => MessageMedia, 'messageId', 'mediaId')
  medias: Media[];
}
