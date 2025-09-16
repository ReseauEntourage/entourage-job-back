import {
  AllowNull,
  BelongsTo,
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
import { RecruitementAlert } from './recruitement-alert.model';

@Table({ tableName: 'RecruitementAlertSkills', timestamps: false })
export class RecruitementAlertSkill extends Model {
  @IsUUID(4)
  @PrimaryKey
  @Default(DataType.UUIDV4)
  @Column
  id: string;

  @IsUUID(4)
  @ForeignKey(() => RecruitementAlert)
  @AllowNull(false)
  @Column
  recruitementAlertId: string;

  @IsUUID(4)
  @ForeignKey(() => Skill)
  @AllowNull(false)
  @Column
  skillId: string;

  @BelongsTo(() => RecruitementAlert, 'recruitementAlertId')
  recruitementAlert: RecruitementAlert;

  @BelongsTo(() => Skill, 'skillId')
  skill: Skill;
}
