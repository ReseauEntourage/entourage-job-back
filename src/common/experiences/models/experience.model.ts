import {
  AllowNull,
  BelongsToMany,
  Column,
  DataType,
  Default,
  HasMany,
  IsUUID,
  Model,
  PrimaryKey,
  Table,
} from 'sequelize-typescript';
import { Skill } from 'src/common/skills/models';
import { ExperienceSkill } from './experience-skill.model';

@Table({
  tableName: 'Experiences',
  timestamps: false,
})
export class Experience extends Model {
  @IsUUID(4)
  @PrimaryKey
  @Default(DataType.UUIDV4)
  @Column
  id: string;

  @AllowNull(false)
  @Column
  description: string;

  @AllowNull(true)
  @Column
  title: string;

  @AllowNull(true)
  @Column
  location: string;

  @AllowNull(true)
  @Column
  company: string;

  @AllowNull(true)
  @Column
  startDate: Date;

  @AllowNull(true)
  @Column
  endDate: Date;

  @BelongsToMany(() => Skill, () => ExperienceSkill, 'ExperienceId', 'SkillId')
  skills: Skill[];

  @HasMany(() => ExperienceSkill, 'ExperienceId')
  experienceSkills: ExperienceSkill[];
}
