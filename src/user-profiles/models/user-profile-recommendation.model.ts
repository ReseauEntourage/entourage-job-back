import { IsString } from 'class-validator';
import {
  AllowNull,
  BelongsTo,
  Column,
  CreatedAt,
  DataType,
  Default,
  DeletedAt,
  ForeignKey,
  IsUUID,
  Model,
  PrimaryKey,
  Table,
  UpdatedAt,
} from 'sequelize-typescript';
import { User } from 'src/users/models';

@Table({ tableName: 'UserProfileRecommendations' })
export class UserProfileRecommendation extends Model {
  @IsUUID(4)
  @PrimaryKey
  @Default(DataType.UUIDV4)
  @Column
  id: string;

  @IsUUID(4)
  @ForeignKey(() => User)
  @AllowNull(false)
  @Column
  UserId: string;

  @IsUUID(4)
  @ForeignKey(() => User)
  @AllowNull(false)
  @Column({ field: 'RecommendedUserId' })
  recommendedUserId: string;

  @CreatedAt
  createdAt: Date;

  @UpdatedAt
  updatedAt: Date;

  @DeletedAt
  deletedAt: Date;

  @IsString()
  @AllowNull(true)
  @Column
  reason: string | null;

  @AllowNull(true)
  @Column(DataType.FLOAT)
  profileScore: number | null;

  @AllowNull(true)
  @Column(DataType.FLOAT)
  needsScore: number | null;

  @AllowNull(true)
  @Column(DataType.FLOAT)
  activityScore: number | null;

  @AllowNull(true)
  @Column(DataType.FLOAT)
  locationCompatibilityScore: number | null;

  @AllowNull(true)
  @Column(DataType.FLOAT)
  finalScore: number | null;

  @BelongsTo(() => User, {
    foreignKey: 'recommendedUserId',
    as: 'recUser',
  })
  recUser: User;
}
