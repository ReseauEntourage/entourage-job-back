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
import { Ambition } from 'src/common/ambitions/models/ambition.model';
import { CV } from './cv.model';

@Table({ tableName: 'CV_Ambitions' })
export class CVAmbition extends Model {
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
  @ForeignKey(() => Ambition)
  @AllowNull(false)
  @Column
  AmbitionId: string;
}
