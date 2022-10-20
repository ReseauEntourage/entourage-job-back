import {
  Column,
  CreatedAt,
  DataType,
  Default,
  HasMany,
  IsUUID,
  Model,
  PrimaryKey,
  Table,
  UpdatedAt,
} from 'sequelize-typescript';
import { RevisionChange } from './revisionChange.model';

@Table({ tableName: 'Revisions' })
export class Revision extends Model {
  @IsUUID(4)
  @PrimaryKey
  @Default(DataType.UUIDV4)
  @Column
  id: string;

  @Column
  model: string;

  @Column(DataType.JSONB)
  document: object;

  @Column
  operation: string;

  @IsUUID(4)
  @Column
  documentId: string;

  @Default(0)
  @Column
  revision: number;

  @HasMany(() => RevisionChange, 'revisionId')
  revisionsChanges: RevisionChange[];

  @CreatedAt
  createdAt: Date;

  @UpdatedAt
  updatedAt: Date;
}
