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
import { BusinessSectorValue } from '../businessSectors.types';

@Table({ tableName: 'BusinessSectors', timestamps: false })
export class BusinessSector extends Model {
  @IsUUID(4)
  @PrimaryKey
  @Default(DataType.UUIDV4)
  @Column
  id: string;

  @AllowNull(false)
  @Column
  name: BusinessSectorValue;

  @AllowNull(false)
  @Default(-1)
  @Column
  order: number;
}
