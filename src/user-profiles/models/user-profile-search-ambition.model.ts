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
import { Ambition } from 'src/common/ambitions/models';
import { UserProfile } from './user-profile.model';

@Table({ tableName: 'User_Profile_Search_Ambitions' })
export class UserProfileSearchAmbition extends Model {
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
  @ForeignKey(() => Ambition)
  @AllowNull(false)
  @Column
  AmbitionId: string;
}
