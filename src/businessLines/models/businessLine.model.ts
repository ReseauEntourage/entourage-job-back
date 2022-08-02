import {
  AllowNull,
  BelongsToMany,
  Column,
  CreatedAt,
  DataType,
  Default,
  DeletedAt,
  IsUUID,
  Model,
  PrimaryKey,
  Table,
  UpdatedAt,
} from 'sequelize-typescript';
import { CV, CVBusinessLine } from 'src/cvs';
import { BusinessLineValue } from './businessLine.types';

@Table({ tableName: 'BusinessLines' })
export class BusinessLine extends Model {
  @IsUUID(4)
  @PrimaryKey
  @Default(DataType.UUIDV4)
  @Column
  id: string;

  @AllowNull(false)
  @Column
  name: BusinessLineValue;

  @AllowNull(false)
  @Default(-1)
  @Column
  order: number;

  @CreatedAt
  createdAt: Date;

  @UpdatedAt
  updatedAt: Date;

  @BelongsToMany(() => CV, () => CVBusinessLine, 'BusinessLineId', 'CVId')
  CVs: CV[];
}
