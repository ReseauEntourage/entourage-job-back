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
} from 'sequelize-typescript';
import { User } from 'src/users/models';

@Table({ tableName: 'AutologinTokens', updatedAt: false })
export class AutologinToken extends Model {
  @IsUUID(4)
  @PrimaryKey
  @Default(DataType.UUIDV4)
  @Column
  id: string;

  @IsUUID(4)
  @ForeignKey(() => User)
  @AllowNull(false)
  @Column
  userId: string;

  @AllowNull(false)
  @Column(DataType.TEXT)
  tokenHash: string;

  @AllowNull(false)
  @Column
  salt: string;

  @AllowNull(false)
  @Column
  expiresAt: Date;

  @AllowNull(true)
  @Column
  consumedAt: Date | null;

  @CreatedAt
  createdAt: Date;

  @BelongsTo(() => User, 'userId')
  user: User;
}
