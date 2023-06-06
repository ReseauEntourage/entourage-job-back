import { ApiProperty } from '@nestjs/swagger';
import { IsString, IsEmail as IsEmailClassValidator } from 'class-validator';
import {
  AllowNull,
  BelongsTo,
  Column,
  CreatedAt,
  DataType,
  Default,
  ForeignKey,
  IsEmail,
  IsUUID,
  Length,
  Model,
  PrimaryKey,
  Table,
  UpdatedAt,
} from 'sequelize-typescript';
import { User } from 'src/users/models';
import { Organization } from './organization.model';

@Table({ tableName: 'Organization_Referents' })
export class OrganizationReferent extends Model {
  @IsUUID(4)
  @PrimaryKey
  @Default(DataType.UUIDV4)
  @Column
  id: string;

  @ApiProperty()
  @IsUUID(4)
  @ForeignKey(() => Organization)
  @AllowNull(false)
  @Column
  OrganizationId: string;

  @ApiProperty()
  @IsUUID(4)
  @ForeignKey(() => User)
  @AllowNull(true)
  @Column
  UserId: string;

  @ApiProperty()
  @IsString()
  @AllowNull(false)
  @Column
  referentFirstName: string;

  @ApiProperty()
  @IsString()
  @AllowNull(false)
  @Column
  referentLastName: string;

  @ApiProperty()
  @IsEmailClassValidator()
  @IsEmail
  @AllowNull(false)
  @Column
  referentMail: string;

  @ApiProperty()
  @IsString()
  @AllowNull(false)
  @Length({ min: 0, max: 30 })
  @Column
  referentPhone: string;

  @BelongsTo(() => Organization, 'OrganizationId')
  organization?: Organization;

  @BelongsTo(() => User, 'UserId')
  user?: User;

  @CreatedAt
  createdAt: Date;

  @UpdatedAt
  updatedAt: Date;
}
