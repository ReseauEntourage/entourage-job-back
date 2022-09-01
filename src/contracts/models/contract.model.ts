import {
  AllowNull,
  BelongsToMany,
  Column,
  CreatedAt,
  DataType,
  Default,
  IsUUID,
  PrimaryKey,
  Table,
  UpdatedAt,
} from 'sequelize-typescript';
import { Contract } from '../contracts.types';
import { CV, CVContract } from 'src/cvs/models';
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
  name: Contract;

  @BelongsToMany(() => CV, () => CVContract, 'ContractId', 'CVId')
  CVs: CV[];

  @CreatedAt
  createdAt: Date;

  @UpdatedAt
  updatedAt: Date;
}
