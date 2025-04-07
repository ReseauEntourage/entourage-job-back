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
import { Formation } from 'src/common/formations/models';
import { UserProfile } from './user-profile.model';

@Table({ tableName: 'UserProfileFormations', timestamps: false })
export class UserProfileFormation extends Model {
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
  @ForeignKey(() => Formation)
  @AllowNull(false)
  @Column
  formationId: string;

  @AllowNull(false)
  @Default(-1)
  @Column
  order: number;
}
