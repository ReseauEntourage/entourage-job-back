import { BadRequestException, Injectable } from '@nestjs/common';
import { InjectModel } from '@nestjs/sequelize';
import { ExternalDatabasesService } from 'src/external-databases/external-databases.service';
import { User } from 'src/users/models';
import { companiesAttributes } from './companies.attributes';
import { CompaniesService } from './companies.service';
import { CompanyCreationContext } from './companies.types';
import { CompanyUser } from './models/company-user.model';
import { Company } from './models/company.model';

@Injectable()
export class CompanyUsersService {
  constructor(
    @InjectModel(CompanyUser)
    private companyUserModel: typeof CompanyUser,
    private readonly companiesService: CompaniesService,
    private readonly externalDatabasesService: ExternalDatabasesService
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

  async findAdminsByCompanyId(companyId: string) {
    const companyUsers = await this.companyUserModel.findAll({
      where: { companyId, isAdmin: true },
      include: {
        model: User,
        as: 'user',
        required: true,
      },
    });
    return companyUsers.map((cu) => cu.user);
  }

  async linkUserToCompany(
    user: Pick<User, 'id' | 'email' | 'firstName' | 'lastName' | 'zone'>,
    companyName: string | null,
    updateInExternalDB = true
  ) {
    // If companyName is provided, find or create the company
    let company: Company | null = null;
    if (companyName) {
      company = await this.companiesService.findOrCreateByName(
        companyName,
        user,
        CompanyCreationContext.COACH_LINKING
      );
    }

    // If updateInExternalDB is true, update the external DB
    if (updateInExternalDB) {
      this.externalDatabasesService.updateUserCompanyExternalDBCompany(
        user.id,
        // If company is null, pass null to unlink the user from any company
        company?.id || null
      );
    }

    // Check for existing link
    const existingLink = await this.companyUserModel.findOne({
      where: { userId: user.id },
      include: [
        {
          model: Company,
          as: 'company',
          attributes: companiesAttributes,
          required: true,
        },
      ],
    });

    if (existingLink) {
      // If companyName is the same as existing link, do nothing
      if (companyName) {
        const existingCompanyName = existingLink.company.name;
        if (existingCompanyName === companyName) {
          return existingLink;
        }
      }
      await existingLink.destroy();
    }

    // If companyName is null or company is null, we just remove the link
    if (!companyName || !company) {
      return null;
    }

    // If no existing link, create a new one
    const newLink = await this.companyUserModel.create({
      userId: user.id,
      companyId: company.id,
      isAdmin: false,
      role: 'employee',
    });

    return newLink;
  }
}
