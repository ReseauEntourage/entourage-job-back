import { ApiProperty } from '@nestjs/swagger';
import { IsString } from 'class-validator';
import {
  AllowNull,
  Column,
  CreatedAt,
  DataType,
  Default,
  ForeignKey,
  IsUUID,
  Model,
  PrimaryKey,
  Table,
  UpdatedAt,
} from 'sequelize-typescript';
import { User } from 'src/users/models';

@Table({ tableName: 'Utm' })
export class Utm extends Model {
  @IsUUID(4)
  @PrimaryKey
  @Default(DataType.UUIDV4)
  @Column
  id: string;

  @ApiProperty()
  @IsString()
  @IsUUID(4)
  @ForeignKey(() => User)
  @AllowNull(false)
  @Column
  userId: string;

  @IsString()
  @AllowNull(true)
  @Default(null)
  @Column
  utmSource: string;

  @IsString()
  @AllowNull(true)
  @Default(null)
  @Column
  utmMedium: string;

  @IsString()
  @AllowNull(true)
  @Default(null)
  @Column
  utmCampaign: string;

  @IsString()
  @AllowNull(true)
  @Default(null)
  @Column
  utmTerm: string;

  @IsString()
  @AllowNull(true)
  @Default(null)
  @Column
  utmContent: string;

  @IsString()
  @AllowNull(true)
  @Default(null)
  @Column
  utmId: string;

  @CreatedAt
  createdAt: Date;

  @UpdatedAt
  updatedAt: Date;
}
