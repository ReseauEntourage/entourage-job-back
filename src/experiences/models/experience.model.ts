import {
  AllowNull,
  BelongsTo,
  BelongsToMany,
  Column,
  DataType,
  Default,
  ForeignKey,
  HasMany,
  IsUUID,
  Model,
  PrimaryKey,
  Table,
} from 'sequelize-typescript';
import { CV } from 'src/cvs/models/cv.model';
import { Skill } from 'src/skills/models';
import { ExperienceSkill } from './experience-skill.model';

@Table({ tableName: 'Experiences' })
export class Experience extends Model {
  @IsUUID(4)
  @PrimaryKey
  @Default(DataType.UUIDV4)
  @Column
  id: string;

  @IsUUID(4)
  @ForeignKey(() => CV)
  @AllowNull(false)
  @Column
  CVId: string;

  @AllowNull(false)
  @Column
  description: string;

  @AllowNull(false)
  @Default(-1)
  @Column
  order: number;

  @BelongsTo(() => CV, 'CVId')
  cv: CV;

  @BelongsToMany(() => Skill, () => ExperienceSkill, 'ExperienceId', 'SkillId')
  skills: Skill[];

  @HasMany(() => ExperienceSkill, 'ExperienceId')
  experienceSkills: ExperienceSkill[];
}
