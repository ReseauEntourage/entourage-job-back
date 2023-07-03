import {
  AllowNull,
  Column,
  DataType,
  Default,
  ForeignKey,
  IsUUID,
  Model,
  PrimaryKey,
  Table,
} from 'sequelize-typescript';
import { BusinessLine } from 'src/common/business-lines/models';
import { Opportunity } from './opportunity.model';

@Table({ tableName: 'Opportunity_BusinessLines' })
export class OpportunityBusinessLine extends Model {
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
  @ForeignKey(() => BusinessLine)
  @AllowNull(false)
  @Column
  BusinessLineId: string;
}
