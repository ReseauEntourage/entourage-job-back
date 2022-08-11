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
import { Skill } from 'src/skills/models';
import { CV } from './cv.model';
import { ExperienceSkill } from './experience-skill.model';

@Table({ tableName: 'Reviews' })
export class Review extends Model {
  @IsUUID(4)
  @PrimaryKey
  @Default(DataType.UUIDV4)
  @Column
  id: string;

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

  @HasMany(() => ExperienceSkill, {
    foreignKey: 'ExperienceId',
  })
  cvSkills: ExperienceSkill[];
}
