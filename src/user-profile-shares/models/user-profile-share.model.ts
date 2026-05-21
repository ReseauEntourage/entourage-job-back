import {
  AllowNull,
  BelongsTo,
  Column,
  CreatedAt,
  DataType,
  Default,
  ForeignKey,
  IsUUID,
  PrimaryKey,
  Table,
  UpdatedAt,
  Model,
} from 'sequelize-typescript';
import { User } from 'src/users/models/user.model';

export type ShareChannel = 'linkedin' | 'whatsapp';

@Table({ tableName: 'UserProfileShares' })
export class UserProfileShare extends Model {
  @IsUUID(4)
  @PrimaryKey
  @Default(DataType.UUIDV4)
  @Column
  id: string;

  @IsUUID(4)
  @ForeignKey(() => User)
  @AllowNull(false)
  @Column
  sharedUserId: string;

  @BelongsTo(() => User, 'sharedUserId')
  sharedUser: User;

  @IsUUID(4)
  @ForeignKey(() => User)
  @AllowNull(true)
  @Column
  sharingUserId: string;

  @BelongsTo(() => User, 'sharingUserId')
  sharingUser: User;

  @AllowNull(false)
  @Column(DataType.ENUM('linkedin', 'whatsapp'))
  channel: ShareChannel;

  @AllowNull(true)
  @Column(DataType.TEXT)
  postUrl: string;

  @CreatedAt
  createdAt: Date;

  @UpdatedAt
  updatedAt: Date;
}
