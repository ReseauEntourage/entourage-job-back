import {
  AllowNull,
  BelongsTo,
  Column,
  DataType,
  Default,
  ForeignKey,
  HasMany,
  IsUUID,
  PrimaryKey,
  Table,
} from 'sequelize-typescript';
import { ExperienceSkill } from 'src/common/experiences/models';
import { FormationSkill } from 'src/common/formations/models';
import { UserProfile } from 'src/user-profiles/models';
import { WrapperModel } from 'src/utils/types';

@Table({ tableName: 'Skills', timestamps: false })
export class Skill extends WrapperModel {
  @IsUUID(4)
  @PrimaryKey
  @Default(DataType.UUIDV4)
  @Column
  id: string;

  @AllowNull(false)
  @Column
  name: string;

  @AllowNull(false)
  @Column
  order: number;

  @ForeignKey(() => UserProfile)
  @AllowNull(false)
  @Column
  userProfileId: string;

  @BelongsTo(() => UserProfile)
  userProfile: UserProfile;

  @HasMany(() => ExperienceSkill)
  experienceSkills: ExperienceSkill[];

  @HasMany(() => ExperienceSkill)
  formationSkills: FormationSkill[];
}
