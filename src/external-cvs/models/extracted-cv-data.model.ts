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
import { UserProfile } from 'src/user-profiles/models/user-profile.model';

@Table({ tableName: 'ExtractedCVData' })
export class ExtractedCVData extends Model {
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

  @Column(DataType.JSONB)
  data: object;

  @Column(DataType.STRING)
  fileHash: string;

  @Column(DataType.NUMBER)
  schemaVersion: number;

  @BelongsTo(() => UserProfile)
  userProfile: UserProfile;
}
