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
import { BusinessLineValue } from '../business-lines.types';
import { CV, CVBusinessLine } from 'src/cvs/models';
import {
  UserProfile,
  UserProfileNetworkBusinessLine,
  UserProfileSearchBusinessLine,
} from 'src/user-profiles/models';
import { WrapperModel } from 'src/utils/types';

@Table({ tableName: 'BusinessLines' })
export class BusinessLine extends WrapperModel {
  @IsUUID(4)
  @PrimaryKey
  @Default(DataType.UUIDV4)
  @Column
  id: string;

  @AllowNull(false)
  @Column
  name: BusinessLineValue;

  @AllowNull(false)
  @Default(-1)
  @Column
  order: number;

  @CreatedAt
  createdAt: Date;

  @UpdatedAt
  updatedAt: Date;

  @BelongsToMany(() => CV, () => CVBusinessLine, 'BusinessLineId', 'CVId')
  CVs: CV[];

  @BelongsToMany(
    () => UserProfile,
    () => UserProfileNetworkBusinessLine,
    'BusinessLineId',
    'UserProfileId'
  )
  networkUserProfiles: CV[];

  @BelongsToMany(
    () => UserProfile,
    () => UserProfileSearchBusinessLine,
    'BusinessLineId',
    'UserProfileId'
  )
  searchUserProfiles: CV[];
}
