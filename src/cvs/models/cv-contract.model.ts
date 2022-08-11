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
import { Contract } from 'src/contracts/models';
import { CV } from './cv.model';

@Table({ tableName: 'CV_Contracts' })
export class CVContract extends Model {
  @IsUUID(4)
  @PrimaryKey
  @Default(DataType.UUIDV4)
  @Column
  id: string;

  @ForeignKey(() => CV)
  @AllowNull(false)
  @Column
  CVId: string;

  @ForeignKey(() => Contract)
  @AllowNull(false)
  @Column
  ContractId: string;
}
