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
import { Revision } from './revision.model';

@Table({ tableName: 'RevisionChanges' })
export class RevisionChange extends Model {
  @IsUUID(4)
  @PrimaryKey
  @Default(DataType.UUIDV4)
  @Column
  id: string;

  @Column
  path: string;

  @Column(DataType.JSONB)
  document: object;

  @Column(DataType.JSONB)
  diff: object;

  @IsUUID(4)
  @ForeignKey(() => Revision)
  @AllowNull(false)
  @Column
  revisionId: string;

  @BelongsTo(() => Revision, 'revisionId')
  revision: Revision;

  @CreatedAt
  createdAt: Date;

  @UpdatedAt
  updatedAt: Date;
}
