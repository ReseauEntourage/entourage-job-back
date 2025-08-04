import { ApiProperty } from '@nestjs/swagger';
import { IsString, MinLength } from 'class-validator';
import {
  AllowNull,
  BelongsToMany,
  Column,
  CreatedAt,
  DataType,
  Default,
  HasMany,
  IsUUID,
  Model,
  PrimaryKey,
  Table,
  UpdatedAt,
} from 'sequelize-typescript';
import { BusinessSector } from 'src/common/business-sectors/models';
import { User } from 'src/users/models';
import { CompanyBusinessSector } from './company-business-sector.model';
import { CompanyInvitation } from './company-invitation.model';
import { CompanyUser } from './company-user.model';

@Table({ tableName: 'Companies' })
export class Company extends Model {
  @IsUUID(4)
  @PrimaryKey
  @Default(DataType.UUIDV4)
  @Column
  id: string;

  @CreatedAt
  createdAt: Date;

  @UpdatedAt
  updatedAt: Date;

  @ApiProperty()
  @IsString()
  @AllowNull(false)
  @Column
  @MinLength(2)
  name: string;

  @ApiProperty()
  @IsString()
  @AllowNull(true)
  @Column
  description: string;

  @ApiProperty()
  @IsString()
  @AllowNull(true)
  @Column
  city: string;

  @ApiProperty()
  @IsString()
  @AllowNull(true)
  @Column
  url: string;

  @ApiProperty()
  @IsString()
  @AllowNull(true)
  @Column
  hiringUrl: string;

  @ApiProperty()
  @IsString()
  @AllowNull(true)
  @Column
  linkedInUrl: string;

  @ApiProperty()
  @IsString()
  @AllowNull(true)
  @Column
  goal: string;

  @ApiProperty()
  @IsString()
  @AllowNull(true)
  @Column
  logoUrl: string;

  @HasMany(() => CompanyUser)
  companyUsers: CompanyUser[];

  @BelongsToMany(() => User, {
    through: () => CompanyUser,
    foreignKey: 'companyId',
    otherKey: 'userId',
  })
  users: User[];

  @HasMany(() => CompanyInvitation)
  pendingInvitations: CompanyInvitation[];

  @HasMany(() => CompanyBusinessSector)
  companyBusinessSectors: CompanyBusinessSector[];

  @BelongsToMany(() => BusinessSector, {
    through: () => CompanyBusinessSector,
    foreignKey: 'companyId',
    otherKey: 'businessSectorId',
  })
  businessSectors: BusinessSector[];
}
