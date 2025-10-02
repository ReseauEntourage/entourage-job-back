import {
  AllowNull,
  Column,
  CreatedAt,
  DataType,
  Default,
  HasMany,
  IsUUID,
  PrimaryKey,
  Table,
  UpdatedAt,
} from 'sequelize-typescript';
import { ExperienceSkill } from 'src/common/experiences/models';
import { FormationSkill } from 'src/common/formations/models';
import { UserProfileSkill } from 'src/user-profiles/models/user-profile-skill.model';
import { WrapperModel } from 'src/utils/types';

@Table({ tableName: 'Skills' })
export class Skill extends WrapperModel {
  @IsUUID(4)
  @PrimaryKey
  @Default(DataType.UUIDV4)
  @Column
  id: string;

  @CreatedAt
  createdAt: Date;

  @UpdatedAt
  updatedAt: Date;

  @AllowNull(false)
  @Column
  name: string;

  @HasMany(() => UserProfileSkill)
  userProfileSkills: UserProfileSkill[];

  @HasMany(() => ExperienceSkill)
  experienceSkills: ExperienceSkill[];

  @HasMany(() => ExperienceSkill)
  formationSkills: FormationSkill[];
}
