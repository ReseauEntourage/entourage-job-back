import {
  AllowNull,
  Column,
  DataType,
  Default,
  IsUUID,
  PrimaryKey,
  Table,
} from 'sequelize-typescript';
import { WrapperModel } from 'src/utils/types';

@Table({ tableName: 'Departments', timestamps: false })
export class Department extends WrapperModel {
  @IsUUID(4)
  @PrimaryKey
  @Default(DataType.UUIDV4)
  @Column
  id: string;

  @AllowNull(false)
  @Column
  name: string;

  @AllowNull(false)
  @Column
  value: string;
}
