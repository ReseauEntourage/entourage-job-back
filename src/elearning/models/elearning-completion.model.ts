import { IsUUID } from 'class-validator';
import {
  AllowNull,
  BelongsTo,
  Column,
  CreatedAt,
  DataType,
  Default,
  ForeignKey,
  Model,
  PrimaryKey,
  Table,
  UpdatedAt,
} from 'sequelize-typescript';
import { User } from 'src/users/models';
import { ElearningUnit } from './elearning-unit.model';

@Table({ tableName: 'ElearningCompletions' })
export class ElearningCompletion extends Model {
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
  unitId: string;

  @AllowNull(false)
  @ForeignKey(() => User)
  @IsUUID(4)
  @Column
  userId: string;

  @AllowNull(false)
  @Default(DataType.NOW)
  @Column
  validatedAt: Date;

  @BelongsTo(() => ElearningUnit)
  unit: ElearningUnit;

  @BelongsTo(() => User)
  user: User;
}
