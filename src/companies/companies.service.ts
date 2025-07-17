import { Injectable } from '@nestjs/common';
import { InjectModel } from '@nestjs/sequelize';
import { searchInColumnWhereOption } from 'src/utils/misc';
import { Company } from './models/company.model';

@Injectable()
export class CompaniesService {
  constructor(
    @InjectModel(Company)
    private companyModel: typeof Company
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
}
