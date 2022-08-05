import {
  AllowNull,
  BelongsToMany,
  Column,
  CreatedAt,
  DataType,
  Default,
  IsUUID,
  Model,
  PrimaryKey,
  Table,
  UpdatedAt,
} from 'sequelize-typescript';
import { BusinessLineValue } from '../businessLines.types';
import { CV, CVBusinessLine } from 'src/cvs';
import { WrapperModel } from 'src/utils/types';

@Table({ tableName: 'BusinessLines' })
export class BusinessLine extends WrapperModel {
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
