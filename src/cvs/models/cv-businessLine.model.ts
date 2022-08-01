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
import { BusinessLine } from 'src/businessLines';
import { CV } from './cv.model';

@Table({ tableName: 'CV_BusinessLines' })
export class CVBusinessLine extends Model {
  @IsUUID(4)
  @PrimaryKey
  @Default(DataType.UUIDV4)
  @Column
  id: string;

  @ForeignKey(() => CV)
  @AllowNull(false)
  @Column
  CVId: string;

  @ForeignKey(() => BusinessLine)
  @AllowNull(false)
  @Column
  BusinessLineId: string;
}
