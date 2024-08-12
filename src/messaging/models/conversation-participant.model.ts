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
import { User } from 'src/users/models';
import { Conversation } from './conversation.model';

@Table({ tableName: 'ConversationParticipants' })
export class ConversationParticipant extends Model {
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
  @ForeignKey(() => User)
  @AllowNull(false)
  @Column
  userId: string;

  @ApiProperty()
  @IsString()
  @IsUUID(4)
  @ForeignKey(() => Conversation)
  @AllowNull(false)
  @Column
  conversationId: string;

  @BelongsTo(() => User, 'userId')
  user: User;

  @BelongsTo(() => Conversation, 'conversationId')
  conversation: Conversation;
}
