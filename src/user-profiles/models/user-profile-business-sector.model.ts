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
import { BusinessSector } from 'src/common/businessSectors/models';
import { UserProfile } from './user-profile.model';

@Table({ tableName: 'UserProfileBusinessSectors', timestamps: false })
export class UserProfileBusinessSector extends Model {
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
  @ForeignKey(() => BusinessSector)
  @AllowNull(false)
  @Column
  businessSectorId: string;
}
