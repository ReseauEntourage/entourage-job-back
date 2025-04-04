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
import { Language } from 'src/common/languages/models';
import { UserProfile } from './user-profile.model';

@Table({ tableName: 'UserProfileLanguages', timestamps: false })
export class UserProfileLanguage extends Model {
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
  @ForeignKey(() => Language)
  @AllowNull(false)
  @Column
  languageId: string;

  @AllowNull(true)
  @Column
  level: string;
}
