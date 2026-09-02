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
import {
  CheckinEmploymentType,
  CheckinExchangeFrequency,
  CheckinExchangeMode,
  CheckinPerceivedSupport,
  CheckinStillInTouch,
} from '../checkin.types';
import { Conversation } from 'src/messaging/models/conversation.model';
import { User } from 'src/users/models';

// One row per (conversationId, userId), created when the user answers Q1/stillInTouch
// (see checkin.service.ts) and never deleted/reset — see messaging-conversation-checkin
// capability.
@Table({ tableName: 'ConversationCheckins' })
export class ConversationCheckin extends Model {
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

  // Q1 — "Are you still in touch with {firstName}?"
  @AllowNull(true)
  @Column(DataType.STRING)
  stillInTouch: CheckinStillInTouch;

  // Q2 — exchange modes (multiple choice)
  @AllowNull(true)
  @Column(DataType.ARRAY(DataType.STRING))
  exchangeModes: CheckinExchangeMode[];

  // Q3 — exchange frequency (single choice)
  @AllowNull(true)
  @Column(DataType.STRING)
  exchangeFrequency: CheckinExchangeFrequency;

  // Q4 — perceived benefits (multiple choice, role-dependent options, "NOTHING_YET" is exclusive)
  @AllowNull(true)
  @Column(DataType.ARRAY(DataType.STRING))
  perceivedBenefits: string[];

  // Sub-question of Q4, only when FIND_JOB_INTERNSHIP_OR_APPRENTICESHIP is selected (candidate)
  @AllowNull(true)
  @Column(DataType.STRING)
  employmentType: CheckinEmploymentType;

  // Q5 — perceived support (single choice)
  @AllowNull(true)
  @Column(DataType.STRING)
  perceivedSupport: CheckinPerceivedSupport;

  // Q6 — relationship rating, 1 to 5
  @AllowNull(true)
  @Column(DataType.INTEGER)
  rating: number;

  // Free-text comment, only shown if rating is 1 or 2. Never visible to the other
  // participant of the conversation.
  @AllowNull(true)
  @Column(DataType.TEXT)
  comment: string;

  // Low-rating final screen (1-2): timestamp of the request to be contacted back by the
  // staffContact, once confirmed. Also used to only trigger the Slack alert once.
  @AllowNull(true)
  @Column
  contactRequestedAt: Date;

  // High-rating final screen (4-5): timestamp of the note being sent to the other
  // participant, once confirmed. Also used to only create the service message once.
  @AllowNull(true)
  @Column
  noteSentAt: Date;

  // Set when the answer to `rating` (last mandatory question) is submitted — marks the
  // checkin as finalized. A checkin without completedAt is "started" and remains
  // resumable; see messaging-conversation-checkin capability.
  @AllowNull(true)
  @Column(DataType.DATE)
  completedAt: Date;

  @CreatedAt
  createdAt: Date;

  @UpdatedAt
  updatedAt: Date;

  @BelongsTo(() => Conversation, 'conversationId')
  conversation: Conversation;

  @BelongsTo(() => User, 'userId')
  user: User;
}
