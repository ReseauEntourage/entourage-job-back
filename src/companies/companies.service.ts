import { Injectable } from '@nestjs/common';
import { InjectModel } from '@nestjs/sequelize';
import { searchInColumnWhereOption } from 'src/utils/misc';
import { CompanyUser } from './models/company-user.model';
import { Company } from './models/company.model';

@Injectable()
export class CompaniesService {
  constructor(
    @InjectModel(Company)
    private companyModel: typeof Company,
    @InjectModel(CompanyUser)
    private companyUserModel: typeof CompanyUser
  ) {}

  async findAll(limit: number, offset: number, search = '') {
    const whereQuery = searchInColumnWhereOption('Company.name', search);

    return this.companyModel.findAll({
      where: whereQuery,
      ...(limit ? { limit } : {}),
      ...(offset ? { offset } : {}),
      order: [['name', 'ASC']],
    });
  }

  async create(createCompanyDto: Partial<Company>) {
    return this.companyModel.create(createCompanyDto, {
      hooks: true,
    });
  }

  async createCompanyUser({ userId, companyId, role }: Partial<CompanyUser>) {
    const companyUser = await this.companyUserModel.create(
      {
        companyId,
        userId,
        role,
      },
      { hooks: true }
    );
    return companyUser;
  }

  async findOneCompany(companyId: string) {
    return this.companyModel.findOne({
      where: { id: companyId },
      order: [['name', 'ASC']],
    });
  }

  async findOneCompanyUser(companyId: string, userId: string) {
    return this.companyUserModel.findOne({
      where: { companyId, userId },
    });
  }
}
