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
import { Language } from 'src/languages/models';
import { CV } from './cv.model';

@Table({ tableName: 'CV_Languages' })
export class CVLanguage extends Model {
  @IsUUID(4)
  @PrimaryKey
  @Default(DataType.UUIDV4)
  @Column
  id: string;

  @ForeignKey(() => CV)
  @AllowNull(false)
  @Column
  CVId: string;

  @ForeignKey(() => Language)
  @AllowNull(false)
  @Column
  LanguageId: string;
}
