import {
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
import { User } from 'src/users/models';
import { Company } from './company.model';

@Table({ tableName: 'CompanyUsers', timestamps: false })
export class CompanyUser extends Model<CompanyUser> {
  @IsUUID(4)
  @PrimaryKey
  @Default(DataType.UUIDV4)
  @Column
  id: string;

  @IsUUID(4)
  @ForeignKey(() => User)
  @Column
  userId: string;

  @IsUUID(4)
  @ForeignKey(() => Company)
  @Column
  companyId: string;

  @Column
  role: string;

  @BelongsTo(() => User)
  user: User;

  @BelongsTo(() => Company)
  company: Company;
}
