import { ApiProperty } from '@nestjs/swagger';
import {
  AllowNull,
  Column,
  CreatedAt,
  Default,
  ForeignKey,
  IsUUID,
  Model,
  PrimaryKey,
  Table,
  UpdatedAt,
} from 'sequelize-typescript';

import { User } from '../../users/models/user.model';

@Table({ tableName: 'User_Social_Situations' })
export class UserSocialSituation extends Model {
  @IsUUID(4)
  @PrimaryKey
  @ForeignKey(() => User)
  @Column
  candidateId: string;

  @ApiProperty()
  @AllowNull(true)
  @Default(null)
  @Column
  materialInsecurity: boolean;

  @ApiProperty()
  @AllowNull(true)
  @Default(null)
  @Column
  networkInsecurity: boolean;

  @ApiProperty()
  @AllowNull(false)
  @Default(false)
  @Column
  hasCompletedSurvey: boolean;

  @CreatedAt
  createdAt: Date;

  @UpdatedAt
  updatedAt: Date;
}
