import {
  AllowNull,
  BelongsTo,
  Column,
  CreatedAt,
  DataType,
  Default,
  ForeignKey,
  IsEmail,
  IsUUID,
  Model,
  PrimaryKey,
  Table,
  UpdatedAt,
} from 'sequelize-typescript';
import { User } from 'src/users/models';
import { Company } from './company.model';

@Table({ tableName: 'CompanyInvitations' })
export class CompanyInvitation extends Model<CompanyInvitation> {
  @IsUUID(4)
  @PrimaryKey
  @Default(DataType.UUIDV4)
  @Column
  id: string;

  @CreatedAt
  createdAt: Date;

  @UpdatedAt
  updatedAt: Date;

  @IsEmail
  @AllowNull(false)
  @Column
  email: string;

  @IsUUID(4)
  @ForeignKey(() => User)
  @Column
  userId: string;

  @IsUUID(4)
  @ForeignKey(() => User)
  @Column
  authorId: string;

  @IsUUID(4)
  @ForeignKey(() => Company)
  @Column
  companyId: string;

  @BelongsTo(() => User)
  user: User;

  @BelongsTo(() => User)
  author: User;

  @BelongsTo(() => Company)
  company: Company;
}
