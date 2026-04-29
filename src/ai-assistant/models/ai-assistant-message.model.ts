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
import { AiAssistantSession } from './ai-assistant-session.model';

export type AiAssistantMessageRole = 'user' | 'assistant';

@Table({ tableName: 'AiAssistantMessages' })
export class AiAssistantMessage extends Model {
  @IsUUID(4)
  @PrimaryKey
  @Default(DataType.UUIDV4)
  @Column
  id: string;

  @IsUUID(4)
  @ForeignKey(() => AiAssistantSession)
  @AllowNull(false)
  @Column
  sessionId: string;

  @AllowNull(false)
  @Column(DataType.ENUM('user', 'assistant'))
  role: AiAssistantMessageRole;

  @AllowNull(false)
  @Column(DataType.TEXT)
  content: string;

  @CreatedAt
  createdAt: Date;

  @UpdatedAt
  updatedAt: Date;

  @BelongsTo(() => AiAssistantSession, 'sessionId')
  session: AiAssistantSession;
}
