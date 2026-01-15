import { IsString, IsNumber } from 'class-validator';
import {
  AllowNull,
  Column,
  DataType,
  Default,
  ForeignKey,
  Model,
  PrimaryKey,
  Table,
  IsUUID,
  CreatedAt,
  UpdatedAt,
  BelongsTo,
  HasMany,
} from 'sequelize-typescript';
import { ElearningAnswer } from './elearning-answer.model';
import { ElearningUnit } from './elearning-unit.model';

@Table({ tableName: 'ElearningQuestions' })
export class ElearningQuestion extends Model {
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
  @IsString()
  @Column
  label: string;

  @AllowNull(false)
  @IsNumber()
  @Column
  order: number;

  @BelongsTo(() => ElearningUnit)
  unit: ElearningUnit;

  @HasMany(() => ElearningAnswer, 'questionId')
  answers: ElearningAnswer[];
}
