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
import { Passion } from 'src/passions/models';
import { CV } from './cv.model';

@Table({ tableName: 'CV_Passions' })
export class CVPassion extends Model {
  @IsUUID(4)
  @PrimaryKey
  @Default(DataType.UUIDV4)
  @Column
  id: string;

  @ForeignKey(() => CV)
  @AllowNull(false)
  @Column
  CVId: string;

  @ForeignKey(() => Passion)
  @AllowNull(false)
  @Column
  PassionId: string;
}
