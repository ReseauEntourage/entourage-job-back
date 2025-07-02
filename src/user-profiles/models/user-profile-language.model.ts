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

  @BelongsTo(() => UserProfile, 'userProfileId')
  userProfile: UserProfile;

  @BelongsTo(() => Language, 'languageId')
  language: Language;

  @AllowNull(true)
  @Column
  level: string;
}
