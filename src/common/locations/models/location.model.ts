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
import { Department } from '../locations.types';
import { CV, CVLocation } from 'src/cvs/models';
import { WrapperModel } from 'src/utils/types';

@Table({ tableName: 'Locations' })
export class Location extends WrapperModel {
  @IsUUID(4)
  @PrimaryKey
  @Default(DataType.UUIDV4)
  @Column
  id: string;

  @AllowNull(false)
  @Column
  name: Department;

  @AllowNull(false)
  @Default(-1)
  @Column
  order: number;

  @BelongsToMany(() => CV, () => CVLocation, 'LocationId', 'CVId')
  CVs: CV[];

  @CreatedAt
  createdAt: Date;

  @UpdatedAt
  updatedAt: Date;
}
