import {
  AllowNull,
  BeforeCreate,
  BelongsToMany,
  Column,
  DataType,
  Default,
  IsUUID,
  Model,
  PrimaryKey,
  Table,
} from 'sequelize-typescript';
import { v4 as uuid } from 'uuid';
import { CV, CVBusinessLine } from 'src/cvs';

@Table({ tableName: 'BusinessLines' })
export class BusinessLine extends Model {
  @IsUUID(4)
  @PrimaryKey
  @Default(DataType.UUIDV4)
  @Column
  id: string;

  @AllowNull(false)
  @Column
  name: string;

  @AllowNull(false)
  @Default(-1)
  @Column
  order: number;

  @BelongsToMany(() => CV, () => CVBusinessLine, 'BusinessLineId', 'CVId')
  CVs: CV[];
}
