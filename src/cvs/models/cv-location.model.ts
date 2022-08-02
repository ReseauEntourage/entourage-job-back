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
import { Location } from 'src/locations';
import { CV } from './cv.model';

@Table({ tableName: 'CV_Locations' })
export class CVLocation extends Model {
  @IsUUID(4)
  @PrimaryKey
  @Default(DataType.UUIDV4)
  @Column
  id: string;

  @ForeignKey(() => CV)
  @AllowNull(false)
  @Column
  CVId: string;

  @ForeignKey(() => Location)
  @AllowNull(false)
  @Column
  LocationId: string;
}
