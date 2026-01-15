import { IsString } from 'class-validator';
import {
  AllowNull,
  BelongsTo,
  Column,
  CreatedAt,
  DataType,
  Default,
  ForeignKey,
  IsUUID,
  Model,
  PrimaryKey,
  Table,
  UpdatedAt,
} from 'sequelize-typescript';
import { UserRole } from 'src/users/users.types';
import { ElearningUnit } from './elearning-unit.model';

@Table({ tableName: 'ElearningUnitRoles' })
export class ElearningUnitRole extends Model {
  @IsUUID(4)
  @PrimaryKey
  @Default(DataType.UUIDV4)
  @Column
  id: string;

  @CreatedAt
  createdAt: Date;

  @UpdatedAt
  updatedAt: Date;

  @AllowNull(false)
  @ForeignKey(() => ElearningUnit)
  @IsUUID(4)
  @Column
  elearningUnitId: string;

  @AllowNull(false)
  @IsString()
  @Column
  role: UserRole;

  @BelongsTo(() => ElearningUnit)
  elearningUnit: ElearningUnit;
}
