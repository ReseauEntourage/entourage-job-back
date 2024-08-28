import {
  BelongsToMany,
  Column,
  CreatedAt,
  DataType,
  Default,
  HasMany,
  IsUUID,
  Model,
  PrimaryKey,
  Table,
  UpdatedAt,
} from 'sequelize-typescript';
import { User } from 'src/users/models';
import { ConversationParticipant } from './conversation-participant.model';
import { Message } from './message.model';

@Table({ tableName: 'Conversations' })
export class Conversation extends Model {
  @IsUUID(4)
  @PrimaryKey
  @Default(DataType.UUIDV4)
  @Column
  id: string;

  @CreatedAt
  createdAt: Date;

  @UpdatedAt
  updatedAt: Date;

  @HasMany(() => Message, 'conversationId')
  messages: Message[];

  @BelongsToMany(() => User, () => ConversationParticipant)
  participants: User[];
}
