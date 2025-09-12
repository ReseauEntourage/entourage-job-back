import {
  BeforeCreate,
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

  @Default(false)
  @Column
  isAdmin: boolean;

  @BelongsTo(() => User)
  user: User;

  @BelongsTo(() => Company)
  company: Company;

  @BeforeCreate
  static async preventMultipleCompanies(companyUser: CompanyUser) {
    const existingAssociations = await CompanyUser.findAll({
      where: {
        userId: companyUser.userId,
      },
    });

    if (existingAssociations.length > 0) {
      throw new Error(
        "Un utilisateur ne peut être associé qu'à une seule entreprise"
      );
    }
  }
}
