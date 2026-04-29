import {
  AllowNull,
  BelongsTo,
  Column,
  CreatedAt,
  DataType,
  Default,
  ForeignKey,
  HasMany,
  IsUUID,
  Model,
  PrimaryKey,
  Table,
  UpdatedAt,
} from 'sequelize-typescript';
import { Conversation } from 'src/messaging/models/conversation.model';
import { User } from 'src/users/models';
import { AiAssistantMessage } from './ai-assistant-message.model';

@Table({ tableName: 'AiAssistantSessions' })
export class AiAssistantSession extends Model {
  @IsUUID(4)
  @PrimaryKey
  @Default(DataType.UUIDV4)
  @Column
  id: string;

  @IsUUID(4)
  @ForeignKey(() => Conversation)
  @AllowNull(false)
  @Column
  conversationId: string;

  @IsUUID(4)
  @ForeignKey(() => User)
  @AllowNull(false)
  @Column
  userId: string;

  @CreatedAt
  createdAt: Date;

  @UpdatedAt
  updatedAt: Date;

  @BelongsTo(() => Conversation, 'conversationId')
  conversation: Conversation;

  @BelongsTo(() => User, 'userId')
  user: User;

  @HasMany(() => AiAssistantMessage, 'sessionId')
  messages: AiAssistantMessage[];
}
