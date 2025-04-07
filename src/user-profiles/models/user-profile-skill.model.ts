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
import { UserProfile } from './user-profile.model';

@Table({ tableName: 'UserProfileSkills', timestamps: false })
export class UserProfileSkill extends Model {
  @IsUUID(4)
  @PrimaryKey
  @Default(DataType.UUIDV4)
  @Column
  id: string;

  @IsUUID(4)
  @ForeignKey(() => UserProfile)
  @AllowNull(false)
  @Column
  userProfileId: string;

  @IsUUID(4)
  @ForeignKey(() => Skill)
  @AllowNull(false)
  @Column
  skillId: string;

  @AllowNull(false)
  @Default(-1)
  @Column
  order: number;
}
