import { BadRequestException, Injectable } from '@nestjs/common';
import { InjectModel } from '@nestjs/sequelize';
import { CompanyUser } from './models/company-user.model';

@Injectable()
export class CompanyUsersService {
  constructor(
    @InjectModel(CompanyUser)
    private companyUserModel: typeof CompanyUser
  ) {}

  async createCompanyUser({
    userId,
    companyId,
    role,
    isAdmin,
  }: Partial<CompanyUser>) {
    try {
      // Vérifier si l'utilisateur est déjà associé à une entreprise
      const existingCompanyUser = await this.companyUserModel.findOne({
        where: { userId },
      });

      if (existingCompanyUser) {
        throw new BadRequestException(
          "Un utilisateur ne peut être associé qu'à une seule entreprise"
        );
      }

      const companyUser = await this.companyUserModel.create(
        {
          companyId,
          userId,
          role,
          isAdmin,
        },
        { hooks: true }
      );
      return companyUser;
    } catch (error) {
      throw error;
    }
  }

  async findOneCompanyUser(companyId: string, userId?: string) {
    return this.companyUserModel.findOne({
      where: { companyId, ...(userId ? { userId } : {}) },
    });
  }

  async findAdminByCompanyId(companyId: string) {
    const companyUser = await this.companyUserModel.findOne({
      where: { companyId, isAdmin: true },
      include: ['user'],
    });
    return companyUser?.user || null;
  }
}
