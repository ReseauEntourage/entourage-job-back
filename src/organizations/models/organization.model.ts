import { ApiProperty } from '@nestjs/swagger';
import { IsString } from 'class-validator';
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
import { AdminZone } from 'src/utils/types';
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
  @AllowNull(false)
  @Column
  address: string;

  @ApiProperty()
  @IsString()
  @AllowNull(true)
  @Column
  zone: AdminZone;

  @HasOne(() => OrganizationReferent, 'OrganizationId')
  organizationReferent: OrganizationReferent;

  @CreatedAt
  createdAt: Date;

  @UpdatedAt
  updatedAt: Date;

  @HasMany(() => User, 'OrganizationId')
  users: User[];
}
