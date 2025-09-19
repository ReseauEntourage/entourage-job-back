import { Injectable } from '@nestjs/common';
import { InjectModel } from '@nestjs/sequelize';
import { CompanyUser } from 'src/companies/models/company-user.model';

@Injectable()
export class CompaniesHelper {
  constructor(
    @InjectModel(CompanyUser)
    private companyUserModel: typeof CompanyUser
  ) {}

  async linkCompanyToUser({
    userId,
    companyId,
    role,
    isAdmin = false,
  }: Partial<CompanyUser>) {
    await this.companyUserModel.create({
      userId,
      companyId,
      role,
      isAdmin,
    });
  }
}
