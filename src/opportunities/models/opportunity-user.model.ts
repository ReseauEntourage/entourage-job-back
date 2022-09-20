import { ApiProperty } from '@nestjs/swagger';
import {
  AllowNull,
  BelongsTo,
  Column,
  DataType,
  Default,
  ForeignKey,
  IsUUID,
  PrimaryKey,
  Table,
} from 'sequelize-typescript';
import { OfferStatus, OfferStatuses } from '../opportunities.types';
import { User } from 'src/users/models';
import { HistorizedModel } from 'src/utils/types';
import { Opportunity } from './opportunity.model';

@Table({ tableName: 'Opportunity_Users' })
export class OpportunityUser extends HistorizedModel {
  @IsUUID(4)
  @PrimaryKey
  @Default(DataType.UUIDV4)
  @Column
  id: string;

  @IsUUID(4)
  @ForeignKey(() => Opportunity)
  @AllowNull(false)
  @Column
  OpportunityId: string;

  @IsUUID(4)
  @ForeignKey(() => User)
  @AllowNull(false)
  @Column
  UserId: string;

  @ApiProperty()
  @AllowNull(false)
  @Default(OfferStatuses.TO_PROCESS.value)
  @Column
  status: OfferStatus;

  @ApiProperty()
  @AllowNull(false)
  @Default(false)
  @Column
  seen: boolean;

  @ApiProperty()
  @AllowNull(false)
  @Default(false)
  @Column
  bookmarked: boolean;

  @ApiProperty()
  @AllowNull(false)
  @Default(false)
  @Column
  archived: boolean;

  @ApiProperty()
  @AllowNull(false)
  @Default(false)
  @Column
  recommended: boolean;

  @ApiProperty()
  @AllowNull(true)
  @Column
  note: string;

  @BelongsTo(() => User, 'UserId')
  user: User;

  @BelongsTo(() => Opportunity, 'OpportunityId')
  opportunity: Opportunity;
}
