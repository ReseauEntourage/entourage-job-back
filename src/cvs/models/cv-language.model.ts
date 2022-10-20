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
import { Language } from 'src/common/languages/models';
import { CV } from './cv.model';

@Table({ tableName: 'CV_Languages' })
export class CVLanguage extends Model {
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
  @ForeignKey(() => Language)
  @AllowNull(false)
  @Column
  LanguageId: string;
}
