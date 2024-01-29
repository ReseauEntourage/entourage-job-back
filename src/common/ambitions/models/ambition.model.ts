import {
  AllowNull,
  BelongsToMany,
  Column,
  CreatedAt,
  DataType,
  Default,
  IsUUID,
  PrimaryKey,
  Table,
  UpdatedAt,
} from 'sequelize-typescript';
import { CV, CVAmbition } from 'src/cvs/models';
import { UserProfileSearchAmbition } from 'src/user-profiles/models';
import { UserProfile } from 'src/user-profiles/models/user-profile.model';
import { WrapperModel } from 'src/utils/types';

@Table({ tableName: 'Ambitions' })
export class Ambition extends WrapperModel {
  @IsUUID(4)
  @PrimaryKey
  @Default(DataType.UUIDV4)
  @Column
  id: string;

  @AllowNull(false)
  @Column
  name: string;

  @AllowNull(false)
  @Default('dans')
  @Column
  prefix: string;

  @AllowNull(false)
  @Default(-1)
  @Column
  order: number;

  @CreatedAt
  createdAt: Date;

  @UpdatedAt
  updatedAt: Date;

  @BelongsToMany(() => CV, () => CVAmbition, 'AmbitionId', 'CVId')
  CVs: CV[];

  @BelongsToMany(
    () => UserProfile,
    () => UserProfileSearchAmbition,
    'AmbitionId',
    'UserProfileId'
  )
  searchUserProfiles: CV[];
}
