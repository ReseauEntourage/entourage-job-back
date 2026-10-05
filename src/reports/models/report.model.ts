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
  ReportReason,
  ReportResolution,
  ReportStatus,
  ReportTargetType,
} from '../reports.types';
import { User } from 'src/users/models';

/**
 * Generic report. The target is polymorphic (`targetType`, `targetId`)
 * without a foreign key: its existence is checked by the service creating
 * the report. A single PENDING report per reporter and target (partial
 * unique index).
 */
@Table({ tableName: 'Reports' })
export class Report extends Model {
  @IsUUID(4)
  @PrimaryKey
  @Default(DataType.UUIDV4)
  @Column
  id: string;

  @AllowNull(false)
  @Column(DataType.STRING(30))
  targetType: ReportTargetType;

  @IsUUID(4)
  @AllowNull(false)
  @Column
  targetId: string;

  @IsUUID(4)
  @ForeignKey(() => User)
  @AllowNull(false)
  @Column
  reporterId: string;

  @AllowNull(false)
  @Column(DataType.STRING(30))
  reason: ReportReason;

  @AllowNull(true)
  @Column(DataType.STRING(1000))
  comment: string | null;

  @AllowNull(false)
  @Default('PENDING')
  @Column(DataType.STRING(20))
  status: ReportStatus;

  @AllowNull(true)
  @Column
  resolvedAt: Date | null;

  @IsUUID(4)
  @ForeignKey(() => User)
  @AllowNull(true)
  @Column
  resolvedById: string | null;

  @AllowNull(true)
  @Column(DataType.STRING(20))
  resolution: ReportResolution | null;

  @CreatedAt
  createdAt: Date;

  @UpdatedAt
  updatedAt: Date;

  @BelongsTo(() => User, { foreignKey: 'reporterId', constraints: false })
  reporter: User;
}
