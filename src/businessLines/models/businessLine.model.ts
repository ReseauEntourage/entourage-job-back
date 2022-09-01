import {
  AllowNull,
  BelongsToMany,
  Column,
  CreatedAt,
  DataType,
  Default,
  IsUUID,
  PrimaryKey,
  Table,
  UpdatedAt,
} from 'sequelize-typescript';
import { BusinessLineValue } from '../businessLines.types';
import { CV, CVBusinessLine } from 'src/cvs/models';
import { WrapperModel } from 'src/utils/types';
import {
  Opportunity,
  OpportunityBusinessLine,
} from '../../opportunities/models';

@Table({ tableName: 'BusinessLines' })
export class BusinessLine extends WrapperModel {
  @IsUUID(4)
  @PrimaryKey
  @Default(DataType.UUIDV4)
  @Column
  id: string;

  @AllowNull(false)
  @Column
  name: BusinessLineValue;

  @AllowNull(false)
  @Default(-1)
  @Column
  order: number;

  @CreatedAt
  createdAt: Date;

  @UpdatedAt
  updatedAt: Date;

  @BelongsToMany(() => CV, () => CVBusinessLine, 'BusinessLineId', 'CVId')
  CVs: CV[];

  @BelongsToMany(
    () => CV,
    () => OpportunityBusinessLine,
    'BusinessLineId',
    'OpportunityId'
  )
  Opportunities: Opportunity[];
}
