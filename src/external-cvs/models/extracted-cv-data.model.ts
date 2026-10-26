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

  @Column(DataType.INTEGER)
  schemaVersion: number;

  // Text read from the CV by the reading pass; null for the single-call
  // extraction and for rows saved before the two-pass extraction
  @AllowNull(true)
  @Column(DataType.TEXT)
  transcript: string | null;

  // Version of the reading instructions that produced `transcript`
  @AllowNull(true)
  @Column(DataType.INTEGER)
  transcriptVersion: number | null;

  @BelongsTo(() => UserProfile)
  userProfile: UserProfile;
}
