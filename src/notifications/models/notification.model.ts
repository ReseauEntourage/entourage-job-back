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
import type {
  NotificationEvent,
  NotificationSubjectType,
  NotificationType,
} from '../notifications.types';
import { User } from 'src/users/models';

/**
 * One row per (recipient, type, subject), unique: a new event on a subject
 * already notified updates the row, which becomes unseen again. The "seen"
 * state is tracked per event (`events[].seenAt`); the row `seenAt` is only
 * derived from it, set once every event is seen. The subject is polymorphic,
 * without a foreign key.
 */
@Table({ tableName: 'Notifications' })
export class Notification extends Model {
  @IsUUID(4)
  @PrimaryKey
  @Default(DataType.UUIDV4)
  @Column
  id: string;

  // Recipient
  @IsUUID(4)
  @ForeignKey(() => User)
  @AllowNull(false)
  @Column
  userId: string;

  @AllowNull(false)
  @Column(DataType.STRING(50))
  type: NotificationType;

  @AllowNull(false)
  @Column(DataType.STRING(30))
  subjectType: NotificationSubjectType;

  @IsUUID(4)
  @AllowNull(false)
  @Column
  subjectId: string;

  // Help group of the subject: display context and emails setting
  @IsUUID(4)
  @AllowNull(true)
  @Column
  groupId: string | null;

  @AllowNull(false)
  @Default([])
  @Column(DataType.JSONB)
  events: NotificationEvent[];

  @AllowNull(true)
  @Column
  seenAt: Date | null;

  @AllowNull(false)
  @Column
  lastEventAt: Date;

  @CreatedAt
  createdAt: Date;

  @UpdatedAt
  updatedAt: Date;

  @BelongsTo(() => User, { foreignKey: 'userId', constraints: false })
  user: User;
}
