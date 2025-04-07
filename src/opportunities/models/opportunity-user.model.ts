import { ApiProperty } from '@nestjs/swagger';
import { Transaction } from 'sequelize/types';
import {
  AfterCreate,
  AfterUpdate,
  AllowNull,
  BelongsTo,
  Column,
  CreatedAt,
  DataType,
  Default,
  DeletedAt,
  ForeignKey,
  HasMany,
  IsUUID,
  PrimaryKey,
  Table,
  UpdatedAt,
} from 'sequelize-typescript';
import { OfferStatus, OfferStatuses } from '../opportunities.types';
import { User } from 'src/users/models';
import { HistorizedModel } from 'src/utils/types';
import { OpportunityUserEvent } from './opportunity-user-event.model';
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

  @HasMany(() => OpportunityUserEvent, 'OpportunityUserId')
  events: OpportunityUserEvent[];

  @CreatedAt
  createdAt: Date;

  @UpdatedAt
  updatedAt: Date;

  @DeletedAt
  deletedAt?: Date;

  @AfterCreate
  static async createAssociations(
    createdOpportunityUser: OpportunityUser,
    options: { transaction: Transaction }
  ) {
    await OpportunityUserStatusChange.create(
      {
        OpportunityUserId: createdOpportunityUser.id,
        oldStatus: null,
        newStatus: createdOpportunityUser.status,
        UserId: createdOpportunityUser.UserId,
        OpportunityId: createdOpportunityUser.OpportunityId,
      },
      options?.transaction ? { transaction: options.transaction } : {}
    );
  }

  @AfterUpdate
  static async updateAssociations(
    updatedOpportunityUser: OpportunityUser,
    options: { transaction: Transaction }
  ) {
    const previousStatus = updatedOpportunityUser.previous('status');
    if (previousStatus !== updatedOpportunityUser.status) {
      await OpportunityUserStatusChange.create(
        {
          oldStatus: previousStatus,
          newStatus: updatedOpportunityUser.status,
          OpportunityUserId: updatedOpportunityUser.id,
          UserId: updatedOpportunityUser.UserId,
          OpportunityId: updatedOpportunityUser.OpportunityId,
        },
        options?.transaction ? { transaction: options.transaction } : {}
      );
    }
  }
}
