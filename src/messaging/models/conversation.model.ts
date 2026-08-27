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

export enum ConversationType {
  DIRECT = 'direct',
  GROUP = 'group',
}

export enum ConversationStage {
  CONTACT_ESTABLISHED = 'CONTACT_ESTABLISHED',
  FIRST_CONTACT_INITIATED = 'FIRST_CONTACT_INITIATED',
  LONG_TERM_SUPPORT = 'LONG_TERM_SUPPORT',
}

export enum ConversationActivityStatus {
  ACTIVE = 'ACTIVE',
  INACTIVE = 'INACTIVE',
}

@Table({ tableName: 'Conversations' })
export class Conversation extends Model {
  @IsUUID(4)
  @PrimaryKey
  @Default(DataType.UUIDV4)
  @Column
  id: string;

  @Default(ConversationType.DIRECT)
  @Column(DataType.STRING)
  type: ConversationType;

  // Only maintained for `direct` conversations (see messaging-conversation-pipeline capability).
  @Default(null)
  @Column(DataType.STRING)
  stage: ConversationStage;

  // Only maintained for `direct` conversations (see messaging-conversation-pipeline capability).
  @Default(null)
  @Column(DataType.STRING)
  activityStatus: ConversationActivityStatus;

  // Only maintained for `direct` conversations (see messaging-conversation-pipeline capability).
  @Default(null)
  @Column
  firstMeetingDetectedAt: Date;

  @CreatedAt
  createdAt: Date;

  @UpdatedAt
  updatedAt: Date;

  @HasMany(() => Message, 'conversationId')
  messages: Message[];

  @BelongsToMany(() => User, () => ConversationParticipant)
  participants: User[];
}
