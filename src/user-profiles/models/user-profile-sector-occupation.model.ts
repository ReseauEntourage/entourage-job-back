import {
  AllowNull,
  BelongsTo,
  Column,
  DataType,
  Default,
  ForeignKey,
  IsUUID,
  Model,
  PrimaryKey,
  Table,
} from 'sequelize-typescript';
import { BusinessSector } from 'src/common/business-sectors/models';
import { Occupation } from 'src/common/occupations/models';
import { UserProfile } from './user-profile.model';

@Table({ tableName: 'UserProfileSectorOccupations', timestamps: false })
export class UserProfileSectorOccupation extends Model {
  @IsUUID(4)
  @PrimaryKey
  @Default(DataType.UUIDV4)
  @Column
  id: string;

  // UserProfile
  @IsUUID(4)
  @ForeignKey(() => UserProfile)
  @AllowNull(false)
  @Column
  userProfileId: string;

  @BelongsTo(() => UserProfile, 'userProfileId')
  userProfile: UserProfile;

  // BusinessSector
  @IsUUID(4)
  @ForeignKey(() => BusinessSector)
  @AllowNull(true)
  @Column
  businessSectorId: string;

  @BelongsTo(() => BusinessSector, 'businessSectorId')
  businessSector: BusinessSector;

  // Occupation
  @IsUUID(4)
  @ForeignKey(() => Occupation)
  @AllowNull(true)
  @Column
  occupationId: string;

  @BelongsTo(() => Occupation, 'occupationId')
  occupation: Occupation;

  @AllowNull(false)
  @Default(-1)
  @Column
  order: number;
}
