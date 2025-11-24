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
import { Skill } from 'src/common/skills/models';
import { Experience } from './experience.model';

@Table({ tableName: 'ExperienceSkills', timestamps: false })
export class ExperienceSkill extends Model {
  @IsUUID(4)
  @PrimaryKey
  @Default(DataType.UUIDV4)
  @Column
  id: string;

  @IsUUID(4)
  @ForeignKey(() => Experience)
  @AllowNull(false)
  @Column
  experienceId: string;

  @IsUUID(4)
  @ForeignKey(() => Skill)
  @AllowNull(false)
  @Column
  skillId: string;

  @AllowNull(false)
  @Column
  order: number;
}
