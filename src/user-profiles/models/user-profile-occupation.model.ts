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
import { Occupation } from 'src/common/occupations/models';
import { UserProfile } from './user-profile.model';

@Table({ tableName: 'UserProfileOccupations', timestamps: false })
export class UserProfileOccupation extends Model {
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
  @ForeignKey(() => Occupation)
  @AllowNull(false)
  @Column
  occupationId: string;
}
