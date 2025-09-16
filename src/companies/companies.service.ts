import fs from 'fs';
import { Injectable, NotFoundException } from '@nestjs/common';
import { InjectModel } from '@nestjs/sequelize';
import { Op } from 'sequelize';
import { Department } from 'src/common/locations/locations.types';
import { S3Service } from 'src/external-services/aws/s3.service';
import { User } from 'src/users/models';
import { searchInColumnWhereOption } from 'src/utils/misc';
import { companiesAttributes } from './companies.attributes';
import { companiesWithUsers } from './companies.includes';
import { UpdateCompanyDto } from './dto/update-company.dto';
import { CompanyBusinessSector } from './models/company-business-sector.model';
import { Company } from './models/company.model';

@Injectable()
export class CompaniesService {
  constructor(
    @InjectModel(Company)
    private companyModel: typeof Company,
    @InjectModel(CompanyBusinessSector)
    private companyBusinessSectorModel: typeof CompanyBusinessSector,
    private readonly s3Service: S3Service
  ) {}

  async findAll(query: {
    limit: number;
    offset: number;
    search: string;
    departments: Department[];
    businessSectorIds: string[];
  }) {
    const { limit, offset, search, departments, businessSectorIds } = query;
    return this.companyModel.findAll({
      include: companiesWithUsers(departments, businessSectorIds),
      attributes: companiesAttributes,
      where: {
        ...(search
          ? { [Op.and]: [searchInColumnWhereOption('Company.name', search)] }
          : {}),
      },
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

  async findOne(companyId: string) {
    return this.companyModel.findOne({
      where: { id: companyId },
      attributes: companiesAttributes,
      include: companiesWithUsers(),
    });
  }

  async findOneWithCompanyUsersAndPendingInvitations(companyId: string) {
    return this.companyModel.findOne({
      where: { id: companyId },
      include: companiesWithUsers(),
      order: [[{ model: User, as: 'users' }, 'createdAt', 'DESC']],
    });
  }

  async update(
    id: string,
    updateCompanyDto: UpdateCompanyDto
  ): Promise<Company> {
    const company = await this.findOne(id);

    if (!company) {
      throw new NotFoundException(`Company with ID ${id} not found`);
    }

    await this.companyModel.update(updateCompanyDto, {
      where: { id },
      returning: true,
    });

    return this.findOne(id);
  }

  async uploadLogo(
    companyId: string,
    file: Express.Multer.File
  ): Promise<void> {
    if (!file) {
      return;
    }
    const { path } = file;
    try {
      const s3file = await this.s3Service.upload(
        fs.readFileSync(path),
        'image/png',
        `${companyId}.png`,
        false,
        true
      );
      await this.update(companyId, { logoUrl: s3file.publicUrl });
    } catch (error) {
      console.error('Error uploading logo:', error);
      throw new Error('Failed to upload logo');
    }
  }

  async updateBusinessSectors(
    companyId: string,
    businessSectorIds: string[]
  ): Promise<void> {
    const company = await this.findOne(companyId);

    if (!company) {
      throw new NotFoundException(`Company with ID ${companyId} not found`);
    }

    const newCompanyBusinessSectors = await Promise.all(
      businessSectorIds.map(async (businessSectorId) => {
        const existingCompanyBusinessSector =
          await this.companyBusinessSectorModel.findOne({
            where: {
              companyId,
              businessSectorId,
            },
          });

        if (existingCompanyBusinessSector) {
          return existingCompanyBusinessSector;
        }

        return await this.companyBusinessSectorModel.create(
          {
            companyId,
            businessSectorId,
          },
          {
            hooks: true,
          }
        );
      })
    );

    // Supprimer les associations qui ne sont plus dans la liste
    await this.companyBusinessSectorModel.destroy({
      where: {
        companyId,
        id: {
          [Op.notIn]: newCompanyBusinessSectors.map(
            (companyBusinessSector) => companyBusinessSector.id
          ),
        },
      },
      individualHooks: true,
    });
  }
}
