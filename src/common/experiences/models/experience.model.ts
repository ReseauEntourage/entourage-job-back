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
  company: string;

  @AllowNull(true)
  @Column
  startDate: Date;

  @AllowNull(true)
  @Column
  endDate: Date;

  @BelongsToMany(() => Skill, () => ExperienceSkill, 'experienceId', 'skillId')
  skills: Skill[];

  @HasMany(() => ExperienceSkill, 'experienceId')
  experienceSkills: ExperienceSkill[];

  @ForeignKey(() => UserProfile)
  @AllowNull(false)
  @Column
  userProfileId: string;

  @BelongsTo(() => UserProfile)
  userProfile: UserProfile;
}
