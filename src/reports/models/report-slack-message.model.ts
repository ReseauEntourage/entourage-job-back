import { Block, KnownBlock } from '@slack/bolt';
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
import type { ReportTargetType } from '../reports.types';

/**
 * A Slack moderation alert about a reported target, kept so that its action
 * buttons are replaced by a « Traité » status once the reports of the target
 * are handled.
 */
@Table({ tableName: 'ReportSlackMessages' })
export class ReportSlackMessage extends Model {
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

  // Channel id returned by Slack, not its name
  @AllowNull(false)
  @Column(DataType.STRING(50))
  channel: string;

  @AllowNull(false)
  @Column(DataType.STRING(50))
  ts: string;

  @AllowNull(false)
  @Column(DataType.JSONB)
  blocks: (Block | KnownBlock)[];

  @AllowNull(true)
  @Column
  handledAt: Date | null;

  @CreatedAt
  createdAt: Date;

  @UpdatedAt
  updatedAt: Date;
}
