import {
  AllowNull,
  Column,
  DataType,
  Default,
  ForeignKey,
  IsUUID,
  Model,
  PrimaryKey,
  Table,
} from 'sequelize-typescript';
import { Skill } from 'src/skills/models';
import { CV } from './cv.model';
import { Experience } from './experience.model';

@Table({ tableName: 'CV_Skills' })
export class ExperienceSkill extends Model {
  @IsUUID(4)
  @PrimaryKey
  @Default(DataType.UUIDV4)
  @Column
  id: string;

  @ForeignKey(() => Experience)
  @AllowNull(false)
  @Column
  ExperienceId: string;

  @ForeignKey(() => Skill)
  @AllowNull(false)
  @Column
  SkillId: string;
}
