import {
  AllowNull,
  BelongsTo,
  Column,
  DataType,
  Default,
  ForeignKey,
  IsUUID,
  Model,
  PrimaryKey,
  Table,
} from 'sequelize-typescript';
import { CV } from './cv.model';

// TODO change name to Searches
@Table({ tableName: 'CV_Searches' })
export class CVSearch extends Model {
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

  @Column
  searchString: string;

  @BelongsTo(() => CV, 'CVId')
  cv: CV;
}
