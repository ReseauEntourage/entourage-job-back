import { IsString, IsBoolean } from 'class-validator';
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
import { ElearningQuestion } from './elearning-question.model';

@Table({ tableName: 'ElearningAnswers' })
export class ElearningAnswer extends Model {
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
  @ForeignKey(() => ElearningQuestion)
  @IsUUID(4)
  @Column
  questionId: string;

  @AllowNull(false)
  @IsString()
  @Column(DataType.TEXT)
  label: string;

  @AllowNull(false)
  @IsBoolean()
  @Default(false)
  @Column
  isCorrect: boolean;

  @BelongsTo(() => ElearningQuestion)
  question: ElearningQuestion;
}
