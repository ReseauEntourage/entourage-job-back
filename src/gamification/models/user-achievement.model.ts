import {
  AllowNull,
  BelongsTo,
  Column,
  CreatedAt,
  DataType,
  Default,
  ForeignKey,
  IsUUID,
  Model,
  PrimaryKey,
  Table,
  UpdatedAt,
} from 'sequelize-typescript';
import {
  AchievementType,
  AchievementTypes,
} from '../config/achievements.config';
import { User } from 'src/users/models';

@Table({ tableName: 'UserAchievements' })
export class UserAchievement extends Model {
  @IsUUID(4)
  @PrimaryKey
  @Default(DataType.UUIDV4)
  @Column(DataType.UUID)
  id: string;

  @CreatedAt
  createdAt: Date;

  @UpdatedAt
  updatedAt: Date;

  @IsUUID(4)
  @ForeignKey(() => User)
  @AllowNull(false)
  @Column(DataType.UUID)
  userId: string;

  @AllowNull(false)
  @Column(DataType.ENUM(...Object.values(AchievementTypes)))
  achievementType: AchievementType;

  @AllowNull(true)
  @Column
  expireAt: Date;

  @AllowNull(false)
  @Default(true)
  @Column
  active: boolean;

  @BelongsTo(() => User, 'userId')
  user: User;
}
