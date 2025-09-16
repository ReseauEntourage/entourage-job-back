import {
  AllowNull,
  BelongsTo,
  Column,
  DataType,
  Default,
  ForeignKey,
  IsUUID,
  Model,
  PrimaryKey,
  Table,
} from 'sequelize-typescript';
import { BusinessSector } from 'src/common/business-sectors/models';
import { RecruitementAlert } from './recruitement-alert.model';

@Table({ tableName: 'RecruitementAlertBusinessSectors', timestamps: false })
export class RecruitementAlertBusinessSector extends Model {
  @IsUUID(4)
  @PrimaryKey
  @Default(DataType.UUIDV4)
  @Column
  id: string;

  @IsUUID(4)
  @ForeignKey(() => RecruitementAlert)
  @AllowNull(false)
  @Column
  recruitementAlertId: string;

  @IsUUID(4)
  @ForeignKey(() => BusinessSector)
  @AllowNull(false)
  @Column
  businessSectorId: string;

  @BelongsTo(() => RecruitementAlert, 'recruitementAlertId')
  recruitementAlert: RecruitementAlert;

  @BelongsTo(() => BusinessSector, 'businessSectorId')
  businessSector: BusinessSector;
}
