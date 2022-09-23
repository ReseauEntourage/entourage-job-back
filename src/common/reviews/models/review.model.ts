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
import { ExperienceSkill } from 'src/common/experiences/models/experience-skill.model';
import { Skill } from 'src/common/skills/models';
import { CV } from 'src/cvs/models/cv.model';

@Table({ tableName: 'Reviews' })
export class Review extends Model {
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
  name: string;

  @AllowNull(false)
  @Column
  text: string;

  @AllowNull(false)
  @Column
  status: string;

  @BelongsTo(() => CV, 'CVId')
  cv: CV;

  @BelongsToMany(() => Skill, () => ExperienceSkill, 'ExperienceId', 'SkillId')
  skills: Skill[];

  @HasMany(() => ExperienceSkill, 'ExperienceId')
  cvSkills: ExperienceSkill[];
}
