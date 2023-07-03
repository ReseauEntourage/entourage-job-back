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
import { BusinessLine } from 'src/common/business-lines/models';
import { CV } from './cv.model';

@Table({ tableName: 'CV_BusinessLines' })
export class CVBusinessLine extends Model {
  @IsUUID(4)
  @PrimaryKey
  @Default(DataType.UUIDV4)
  @Column
  id: string;

  @IsUUID(4)
  @ForeignKey(() => CV)
  @AllowNull(false)
  @Column
  CVId: string;

  @IsUUID(4)
  @ForeignKey(() => BusinessLine)
  @AllowNull(false)
  @Column
  BusinessLineId: string;
}
