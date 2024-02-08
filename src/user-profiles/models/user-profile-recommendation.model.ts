import {
  AllowNull,
  BelongsTo,
  Column,
  DataType,
  Default,
  ForeignKey,
  IsUUID,
  Model,
  PrimaryKey,
  Table,
} from 'sequelize-typescript';
import { UserProfile } from './user-profile.model';

@Table({ tableName: 'User_Profiles_Recommendations' })
export class UserProfileRecommendation extends Model {
  @IsUUID(4)
  @PrimaryKey
  @Default(DataType.UUIDV4)
  @Column
  id: string;

  @IsUUID(4)
  @ForeignKey(() => UserProfile)
  @AllowNull(false)
  @Column
  UserProfileId: string;

  @IsUUID(4)
  @ForeignKey(() => UserProfile)
  @AllowNull(false)
  @Column
  RecommendedUserProfileId: string;

  @BelongsTo(() => UserProfile, 'UserProfileId')
  userProfile: UserProfile;
}
