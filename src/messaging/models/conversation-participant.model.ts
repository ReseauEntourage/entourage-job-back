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
  IsDate,
  IsUUID,
  Model,
  PrimaryKey,
  Table,
  UpdatedAt,
} from 'sequelize-typescript';
import { User } from 'src/users/models';
import { ConversationFeedback } from './conversation-feedback.model';
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

  @IsDate
  @Default(null)
  @Column
  seenAt: Date;

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

  @ApiProperty()
  @IsString()
  @IsUUID(4)
  @ForeignKey(() => ConversationFeedback)
  @AllowNull(true)
  @Column
  conversationFeedbackId: string;

  @BelongsTo(() => User, 'userId')
  user: User;

  @BelongsTo(() => Conversation, 'conversationId')
  conversation: Conversation;

  @BelongsTo(() => ConversationFeedback, 'conversationFeedbackId')
  feedback: ConversationFeedback;
}
