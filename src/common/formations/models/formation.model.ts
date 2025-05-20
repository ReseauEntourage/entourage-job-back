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
import { UserProfile } from 'src/user-profiles/models';
import { FormationSkill } from './formation-skill.model';

@Table({ tableName: 'Formations', timestamps: false })
export class Formation extends Model {
  @IsUUID(4)
  @PrimaryKey
  @Default(DataType.UUIDV4)
  @Column
  id: string;

  @AllowNull(true)
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

  @BelongsToMany(() => Skill, () => FormationSkill, 'formationId', 'skillId')
  skills: Skill[];

  @HasMany(() => FormationSkill, 'formationId')
  formationSkills: FormationSkill[];

  @ForeignKey(() => UserProfile)
  @AllowNull(false)
  @Column
  userProfileId: string;

  @BelongsTo(() => UserProfile)
  userProfile: UserProfile;
}
