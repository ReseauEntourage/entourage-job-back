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

@Table({ tableName: 'Skills', timestamps: false })
export class Skill extends WrapperModel {
  @IsUUID(4)
  @PrimaryKey
  @Default(DataType.UUIDV4)
  @Column
  id: string;

  @AllowNull(false)
  @Column
  name: string;
}
