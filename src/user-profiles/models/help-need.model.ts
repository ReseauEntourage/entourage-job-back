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
import { HelpValue } from '../user-profiles.types';
import { UserProfile } from './user-profile.model';

@Table({ tableName: 'Help_Needs' })
export class HelpNeed extends Model {
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

  @AllowNull(false)
  @Column
  name: HelpValue;

  @CreatedAt
  createdAt: Date;

  @UpdatedAt
  updatedAt: Date;

  @BelongsTo(() => UserProfile, 'UserProfileId')
  userProfile: UserProfile;
}
