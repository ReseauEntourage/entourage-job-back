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
import { User } from 'src/users/models';
import { HelpGroup } from './help-group.model';

/**
 * A membership is active while `leftAt` is null. Joining again after leaving
 * creates a new row.
 */
@Table({ tableName: 'HelpGroupMemberships' })
export class HelpGroupMembership extends Model {
  @IsUUID(4)
  @PrimaryKey
  @Default(DataType.UUIDV4)
  @Column
  id: string;

  @IsUUID(4)
  @ForeignKey(() => HelpGroup)
  @AllowNull(false)
  @Column
  groupId: string;

  @IsUUID(4)
  @ForeignKey(() => User)
  @AllowNull(false)
  @Column
  userId: string;

  @AllowNull(true)
  @Column
  charterAcceptedAt: Date | null;

  @AllowNull(true)
  @Column
  leftAt: Date | null;

  @CreatedAt
  createdAt: Date;

  @UpdatedAt
  updatedAt: Date;

  @BelongsTo(() => HelpGroup, 'groupId')
  group: HelpGroup;

  @BelongsTo(() => User, { foreignKey: 'userId', constraints: false })
  user: User;
}
