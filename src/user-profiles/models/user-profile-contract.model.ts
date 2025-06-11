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
import { Contract } from 'src/common/contracts/models';
import { UserProfile } from './user-profile.model';

@Table({ tableName: 'UserProfileContracts', timestamps: false })
export class UserProfileContract extends Model {
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
  @ForeignKey(() => Contract)
  @AllowNull(false)
  @Column
  contractId: string;
}
