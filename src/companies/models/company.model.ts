import { ApiProperty } from '@nestjs/swagger';
import { IsString, MinLength } from 'class-validator';
import {
  AllowNull,
  BelongsTo,
  BelongsToMany,
  Column,
  CreatedAt,
  DataType,
  Default,
  ForeignKey,
  HasMany,
  IsUUID,
  Model,
  PrimaryKey,
  Table,
  UpdatedAt,
} from 'sequelize-typescript';
import { BusinessSector } from 'src/common/business-sectors/models';
import { Department } from 'src/common/departments/models/department.model';
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

  companyUser: CompanyUser;

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

  @ApiProperty()
  @IsString()
  @AllowNull(true)
  @ForeignKey(() => Department)
  @Column
  departmentId: string;

  @BelongsTo(() => Department)
  department: Department;

  get admin(): User | null {
    if (!this.users) {
      return null;
    }

    const adminCompanyUser = this.users.find((u) => {
      return u.companyUser.isAdmin;
    });
    if (!adminCompanyUser) {
      return null;
    }

    return adminCompanyUser;
  }
}
