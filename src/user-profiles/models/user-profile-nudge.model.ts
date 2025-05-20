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
} from 'sequelize-typescript';
import { Nudge } from 'src/common/nudge/models';
import { UserProfile } from 'src/user-profiles/models';

@Table({ tableName: 'UserProfileNudges', updatedAt: false })
export class UserProfileNudge extends Model {
  @IsUUID(4)
  @PrimaryKey
  @Default(DataType.UUIDV4)
  @Column
  id: string;

  @CreatedAt
  createdAt: Date;

  @AllowNull(true)
  @Column
  content: string;

  @IsUUID(4)
  @ForeignKey(() => UserProfile)
  @AllowNull(false)
  @Column
  userProfileId: string;

  @BelongsTo(() => UserProfile, 'userProfileId')
  userProfile: UserProfile;

  @IsUUID(4)
  @ForeignKey(() => Nudge)
  @AllowNull(true)
  @Column
  nudgeId: string;

  @BelongsTo(() => Nudge, 'nudgeId')
  nudge: Nudge;
}
