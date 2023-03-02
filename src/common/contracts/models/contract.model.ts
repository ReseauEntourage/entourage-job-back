import {
  AllowNull,
  Column,
  CreatedAt,
  DataType,
  Default,
  IsUUID,
  PrimaryKey,
  Table,
  UpdatedAt,
} from 'sequelize-typescript';
import { ContractValue } from 'src/common/contracts/contracts.types';
import { WrapperModel } from 'src/utils/types';

@Table({ tableName: 'Contracts' })
export class Contract extends WrapperModel {
  @IsUUID(4)
  @PrimaryKey
  @Default(DataType.UUIDV4)
  @Column
  id: string;

  @AllowNull(false)
  @Column
  name: ContractValue;

  @CreatedAt
  createdAt: Date;

  @UpdatedAt
  updatedAt: Date;
}
