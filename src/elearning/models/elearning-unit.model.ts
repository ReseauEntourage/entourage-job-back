import { IsNumber, IsString } from 'class-validator';
import {
  AllowNull,
  Column,
  CreatedAt,
  DataType,
  Default,
  HasMany,
  IsUUID,
  Model,
  PrimaryKey,
  Table,
  UpdatedAt,
} from 'sequelize-typescript';
import { ElearningCompletion } from './elearning-completion.model';
import { ElearningQuestion } from './elearning-question.model';
import { ElearningUnitRole } from './elearning-unit-role.model';

@Table({ tableName: 'ElearningUnits' })
export class ElearningUnit extends Model {
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
  @IsString()
  @Column
  title: string;

  @AllowNull(true)
  @IsString()
  @Column
  description?: string;

  @AllowNull(false)
  @IsString()
  @Column
  videoUrl: string;

  @AllowNull(true)
  @IsNumber()
  @Column
  durationMinutes?: number;

  @AllowNull(false)
  @IsNumber()
  @Column
  order: number;

  @HasMany(() => ElearningQuestion, 'unitId')
  questions: ElearningQuestion[];

  @HasMany(() => ElearningUnitRole, 'unitId')
  roles: ElearningUnitRole[];

  @HasMany(() => ElearningCompletion, 'unitId')
  userCompletions: ElearningCompletion[];
}
