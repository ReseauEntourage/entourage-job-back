import {
  AllowNull,
  Column,
  DataType,
  Default,
  ForeignKey,
  IsUUID,
  Model,
  PrimaryKey,
  Table,
} from 'sequelize-typescript';
import { Experience } from 'src/common/experiences/models';
import { UserProfile } from './user-profile.model';

@Table({ tableName: 'UserProfileExperiences', timestamps: false })
export class UserProfileExperience extends Model {
  @IsUUID(4)
  @PrimaryKey
  @Default(DataType.UUIDV4)
  @Column
  id: string;

  @IsUUID(4)
  @ForeignKey(() => UserProfile)
  @AllowNull(false)
  @Column
  userProfileId: string;

  @IsUUID(4)
  @ForeignKey(() => Experience)
  @AllowNull(false)
  @Column
  experienceId: string;

  @AllowNull(false)
  @Default(-1)
  @Column
  order: number;
}
