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
import { FormationSkill } from './formation-skill.model';

@Table({ tableName: 'Formations' })
export class Formation extends Model {
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
  institution: string;

  @AllowNull(true)
  @Column
  startDate: Date;

  @AllowNull(true)
  @Column
  endDate: Date;

  @BelongsToMany(() => Skill, () => FormationSkill, 'FormationId', 'SkillId')
  skills: Skill[];

  @HasMany(() => FormationSkill, 'FormationId')
  formationSkills: FormationSkill[];
}
