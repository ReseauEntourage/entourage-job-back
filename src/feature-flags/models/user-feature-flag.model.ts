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
import { User } from 'src/users/models';
import { FeatureKey } from './feature-key.types';

@Table({ tableName: 'UserFeatureFlags' })
export class UserFeatureFlag extends Model {
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
  @Column(DataType.STRING)
  featureKey: FeatureKey;

  @AllowNull(false)
  @Default(true)
  @Column(DataType.BOOLEAN)
  enabled: boolean;

  @BelongsTo(() => User, 'userId')
  user: User;
}
