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
import { User } from 'src/users/models';
import { AiAssistantMessage } from './ai-assistant-message.model';

/**
 * One AI assistant thread per (user, recipient): it exists independently of
 * any conversation, so it can be used before the first message is sent.
 */
@Table({ tableName: 'AiAssistantSessions' })
export class AiAssistantSession extends Model {
  @IsUUID(4)
  @PrimaryKey
  @Default(DataType.UUIDV4)
  @Column
  id: string;

  @IsUUID(4)
  @ForeignKey(() => User)
  @AllowNull(false)
  @Column
  userId: string;

  @IsUUID(4)
  @ForeignKey(() => User)
  @AllowNull(false)
  @Column
  recipientId: string;

  @CreatedAt
  createdAt: Date;

  @UpdatedAt
  updatedAt: Date;

  @BelongsTo(() => User, 'userId')
  user: User;

  @BelongsTo(() => User, 'recipientId')
  recipient: User;

  @HasMany(() => AiAssistantMessage, 'sessionId')
  messages: AiAssistantMessage[];
}
