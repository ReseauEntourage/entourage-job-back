import {
  AllowNull,
  BelongsTo,
  Column,
  CreatedAt,
  DataType,
  Default,
  IsUUID,
  Model,
  PrimaryKey,
  Table,
} from 'sequelize-typescript';
import { UserProfile } from 'src/user-profiles/models';

@Table({ tableName: 'Reviews', updatedAt: false })
export class Review extends Model {
  @IsUUID(4)
  @PrimaryKey
  @Default(DataType.UUIDV4)
  @Column
  id: string;

  @CreatedAt
  createdAt: Date;

  @IsUUID(4)
  @AllowNull(false)
  @Column
  userProfileId: string;

  @BelongsTo(() => UserProfile, 'userProfileId')
  userProfile?: UserProfile;

  @AllowNull(false)
  @Column
  authorName: string;

  @AllowNull(false)
  @Column
  authorLabel: string;

  @AllowNull(false)
  @Column
  content: string;
}
