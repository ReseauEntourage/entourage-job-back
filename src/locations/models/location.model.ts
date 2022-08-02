import {
  AllowNull,
  BelongsToMany,
  Column,
  CreatedAt,
  DataType,
  Default,
  DeletedAt,
  IsUUID,
  Model,
  PrimaryKey,
  Table,
  UpdatedAt,
} from 'sequelize-typescript';
import { CV, CVLocation } from 'src/cvs';
import { Department } from './location.types';

@Table({ tableName: 'Locations' })
export class Location extends Model {
  @IsUUID(4)
  @PrimaryKey
  @Default(DataType.UUIDV4)
  @Column
  id: string;

  @AllowNull(false)
  @Column
  name: Department;

  @BelongsToMany(() => CV, () => CVLocation, 'LocationId', 'CVId')
  CVs: CV[];

  @CreatedAt
  createdAt: Date;

  @UpdatedAt
  updatedAt: Date;
}
