import {
  AllowNull,
  Column,
  DataType,
  Default,
  IsUUID,
  Model,
  PrimaryKey,
  Table,
} from 'sequelize-typescript';
import { DepartmentCode } from 'src/utils/types/departments.types';

@Table({ tableName: 'Departments', timestamps: false })
export class Department extends Model {
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
  value: DepartmentCode;

  @Column(DataType.VIRTUAL)
  get displayName(): string {
    const name = this.getDataValue('name') as string;
    const value = this.getDataValue('value') as string;
    return `${name} (${value})`;
  }
}
