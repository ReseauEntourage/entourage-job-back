import { IsString } from 'class-validator';
import { Column, Model, PrimaryKey, Table } from 'sequelize-typescript';

@Table({ tableName: 'SequelizeMeta', timestamps: false })
export class SequelizeMeta extends Model {
  @IsString()
  @PrimaryKey
  @Column
  name: string;
}
