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
import { Contract } from 'src/common/contracts/models';
import { CV } from './cv.model';

@Table({ tableName: 'CV_Contracts' })
export class CVContract extends Model {
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
  @ForeignKey(() => Contract)
  @AllowNull(false)
  @Column
  ContractId: string;
}
