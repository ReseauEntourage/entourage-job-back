import { ApiProperty } from '@nestjs/swagger';
import {
  AllowNull,
  BelongsTo,
  HasMany,
  Column,
  DataType,
  Default,
  ForeignKey,
  IsUUID,
  PrimaryKey,
  Table,
  AfterCreate,
  BeforeUpdate,
} from 'sequelize-typescript';
import { OfferStatus, OfferStatuses } from '../opportunities.types';
import { User } from 'src/users/models';
import { HistorizedModel } from 'src/utils/types';
import { OpportunityUserStatusChange } from './opportunity-user-status-change.model';
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

  @HasMany(() => OpportunityUserStatusChange, 'opportunityUserStatusChanges')
  opportunityUserStatusChanges: OpportunityUserStatusChange[];

  @AfterCreate
  static async createAssociations(createdOpportunityUser: OpportunityUser) {
    OpportunityUserStatusChange.create({
      OpportunityUserId: createdOpportunityUser.id,
      oldStatus: null,
      newStatus: createdOpportunityUser.status,
    });
  }

  @BeforeUpdate
  static async updateAssociations(updatedOpportunityUser: OpportunityUser) {
    const previousStatus = updatedOpportunityUser.previous().status;
    OpportunityUserStatusChange.create({
      OpportunityUserId: updatedOpportunityUser.id,
      oldStatus: previousStatus,
      newStatus: updatedOpportunityUser.status,
    });
  }
}
