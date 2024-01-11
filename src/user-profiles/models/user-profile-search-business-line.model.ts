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
import { BusinessLine } from 'src/common/business-lines/models';
import { UserProfile } from './user-profile.model';

@Table({ tableName: 'User_Profile_Search_BusinessLines' })
export class UserProfileSearchBusinessLine extends Model {
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
  @ForeignKey(() => BusinessLine)
  @AllowNull(false)
  @Column
  BusinessLineId: string;
}
