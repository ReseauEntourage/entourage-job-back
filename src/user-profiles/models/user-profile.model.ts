import { ApiProperty } from '@nestjs/swagger';
import { IsArray, IsOptional, IsString } from 'class-validator';
import {
  AllowNull,
  BelongsToMany,
  Column,
  CreatedAt,
  DataType,
  Default,
  DeletedAt,
  HasMany,
  IsUUID,
  Model,
  PrimaryKey,
  Table,
  UpdatedAt,
} from 'sequelize-typescript';
import { BusinessLine } from 'src/common/business-lines/models';
import { HelpNeed } from './help-need.model';
import { HelpOffer } from './help-offer.model';
import { UserProfileNetworkBusinessLine } from './user-profile-network-business-line.model';
import { UserProfileSearchAmbition } from './user-profile-search-ambition.model';
import { UserProfileSearchBusinessLine } from './user-profile-search-business-line.model';

@Table({ tableName: 'User_Profiles' })
export class UserProfile extends Model {
  @IsUUID(4)
  @PrimaryKey
  @Default(DataType.UUIDV4)
  @Column
  id: string;

  @ApiProperty()
  @IsString()
  @AllowNull(true)
  @Column
  description: string;

  @ApiProperty()
  @IsString()
  @AllowNull(true)
  @Column
  currentJob: string;

  @CreatedAt
  createdAt: Date;

  @UpdatedAt
  updatedAt: Date;

  @DeletedAt
  deletedAt: Date;

  @BelongsToMany(
    () => BusinessLine,
    () => UserProfileNetworkBusinessLine,
    'UserProfileId',
    'BusinessLineId'
  )
  networkBusinessLines: BusinessLine[];

  @HasMany(() => UserProfileNetworkBusinessLine, 'UserProfileId')
  userProfileNetworkBusinessLines: UserProfileNetworkBusinessLine[];

  @BelongsToMany(
    () => BusinessLine,
    () => UserProfileSearchBusinessLine,
    'UserProfileId',
    'BusinessLineId'
  )
  searchBusinessLines: BusinessLine[];

  @HasMany(() => UserProfileSearchBusinessLine, 'UserProfileId')
  userProfileSearchBusinessLines: UserProfileSearchBusinessLine[];

  @ApiProperty()
  @IsArray()
  @IsOptional()
  @BelongsToMany(
    () => UserProfileSearchAmbition,
    () => UserProfileSearchAmbition,
    'UserProfileId',
    'AmbitionId'
  )
  searchAmbitions: UserProfileSearchAmbition[];

  @ApiProperty()
  @IsArray()
  @IsOptional()
  @HasMany(() => UserProfileSearchAmbition, 'UserProfileId')
  userProfileSearchAmbitions: UserProfileSearchAmbition[];

  @ApiProperty()
  @IsArray()
  @IsOptional()
  @HasMany(() => HelpNeed, 'UserProfileId')
  helpNeeds: HelpNeed[];

  @ApiProperty()
  @IsArray()
  @IsOptional()
  @HasMany(() => HelpOffer, 'UserProfileId')
  helpOffers: HelpOffer[];
}
