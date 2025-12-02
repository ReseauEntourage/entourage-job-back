import { ApiProperty } from '@nestjs/swagger';
import { IsOptional, IsString } from 'class-validator';
import {
  AllowNull,
  Column,
  CreatedAt,
  DataType,
  Default,
  HasMany,
  HasOne,
  IsUUID,
  Model,
  PrimaryKey,
  Table,
  UpdatedAt,
} from 'sequelize-typescript';
import { User } from 'src/users/models';
import { ZoneName } from 'src/utils/types/zones.types';
import { OrganizationReferent } from './organization-referent.model';

@Table({ tableName: 'Organizations' })
export class Organization extends Model {
  @IsUUID(4)
  @PrimaryKey
  @Default(DataType.UUIDV4)
  @Column
  id: string;

  @ApiProperty()
  @IsString()
  @AllowNull(false)
  @Column
  name: string;

  @ApiProperty()
  @IsString()
  @IsOptional()
  @AllowNull(true)
  @Column
  address: string;

  @ApiProperty()
  @IsString()
  @AllowNull(false)
  @Column
  zone: ZoneName;

  @HasOne(() => OrganizationReferent, 'OrganizationId')
  organizationReferent: OrganizationReferent;

  @CreatedAt
  createdAt: Date;

  @UpdatedAt
  updatedAt: Date;

  @HasMany(() => User, 'OrganizationId')
  users: User[];
}
