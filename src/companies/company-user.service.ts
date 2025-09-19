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

  async linkUserToCompany(userId: string, companyId: string | null) {
    const existingLink = await this.companyUserModel.findOne({
      where: { userId },
    });

    if (existingLink) {
      // Remove existing link if it exists
      await existingLink.destroy();
    }

    if (!companyId) {
      await this.companyUserModel.destroy({ where: { userId } });
      return null;
    }
    const newLink = await this.companyUserModel.create({
      userId,
      companyId,
      isAdmin: false,
      role: 'employee',
    });
    return newLink;
  }
}
