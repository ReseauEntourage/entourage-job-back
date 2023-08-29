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
import { Skill } from 'src/common/skills/models';
import { CV } from 'src/cvs/models/cv.model';
import { FormationSkill } from './formation-skill.model';

@Table({ tableName: 'Formations' })
export class Formation extends Model {
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
  dateStart: Date;

  @AllowNull(true)
  @Column
  dateEnd: Date;

  @BelongsTo(() => CV, 'CVId')
  cv: CV;

  @BelongsToMany(() => Skill, () => FormationSkill, 'FormationId', 'SkillId')
  skills: Skill[];

  @HasMany(() => FormationSkill, 'FormationId')
  formationSkills: FormationSkill[];
}
