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
import { User } from 'src/users/models';

@Table({ tableName: 'ExtractedCVData' })
export class ExtractedCVData extends Model {
  @IsUUID(4)
  @PrimaryKey
  @Default(DataType.UUIDV4)
  @Column
  id: string;

  @IsUUID(4)
  @ForeignKey(() => User)
  @AllowNull(false)
  @Column
  userId: string;

  @Column(DataType.JSONB)
  data: object;

  @Column(DataType.STRING)
  fileHash: string;

  @Column(DataType.NUMBER)
  schemaVersion: number;

  @BelongsTo(() => User)
  user: User;
}
