import {
  AllowNull,
  Column,
  CreatedAt,
  DataType,
  Default,
  IsUUID,
  Model,
  PrimaryKey,
  Table,
  UpdatedAt,
} from 'sequelize-typescript';
import type {
  CommunicationChannel,
  CommunicationMetadata,
} from '../communication-logs.types';

/**
 * Trace of a SMS or an email accepted by its provider for a given user. It
 * stores who received which kind of communication and when, never an address,
 * a phone number or any content.
 */
@Table({ tableName: 'CommunicationLogs' })
export class CommunicationLog extends Model {
  @IsUUID(4)
  @PrimaryKey
  @Default(DataType.UUIDV4)
  @Column
  id: string;

  // No foreign key on purpose: the rows outlive the deletion of the account
  @IsUUID(4)
  @AllowNull(false)
  @Column
  userId: string;

  @AllowNull(false)
  @Column(DataType.STRING(10))
  channel: CommunicationChannel;

  // Template name for an email, message type for an SMS
  @AllowNull(false)
  @Column(DataType.STRING(100))
  type: string;

  @AllowNull(true)
  @Column(DataType.JSONB)
  metadata: CommunicationMetadata | null;

  // Id the provider gave to the message (Mailjet MessageID, Vonage message
  // UUID); null when the provider did not communicate it
  @AllowNull(true)
  @Column(DataType.STRING(100))
  providerMessageId: string | null;

  @AllowNull(false)
  @Column
  sentAt: Date;

  @CreatedAt
  createdAt: Date;

  @UpdatedAt
  updatedAt: Date;
}
