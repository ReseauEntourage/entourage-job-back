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
import { Company } from './company.model';

@Table({ tableName: 'CompanyBusinessSectors', timestamps: false })
export class CompanyBusinessSector extends Model {
  @IsUUID(4)
  @PrimaryKey
  @Default(DataType.UUIDV4)
  @Column
  id: string;

  @IsUUID(4)
  @ForeignKey(() => Company)
  @AllowNull(false)
  @Column
  companyId: string;

  @IsUUID(4)
  @ForeignKey(() => BusinessSector)
  @AllowNull(false)
  @Column
  businessSectorId: string;

  @BelongsTo(() => Company)
  company: Company;

  @BelongsTo(() => BusinessSector)
  businessSector: BusinessSector;
}
