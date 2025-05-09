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
import { Formation } from './formation.model';

@Table({ tableName: 'FormationSkills' })
export class FormationSkill extends Model {
  @IsUUID(4)
  @PrimaryKey
  @Default(DataType.UUIDV4)
  @Column
  id: string;

  @IsUUID(4)
  @ForeignKey(() => Formation)
  @AllowNull(false)
  @Column
  FormationId: string;

  @IsUUID(4)
  @ForeignKey(() => Skill)
  @AllowNull(false)
  @Column
  SkillId: string;
}
