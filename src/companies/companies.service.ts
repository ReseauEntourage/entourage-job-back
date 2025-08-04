import fs from 'fs';
import { Injectable, NotFoundException } from '@nestjs/common';
import { InjectModel } from '@nestjs/sequelize';
import { Op } from 'sequelize';
import { S3Service } from 'src/external-services/aws/s3.service';
import { Conversation } from 'src/messaging/models';
import { User } from 'src/users/models';
import { searchInColumnWhereOption } from 'src/utils/misc';
import { UpdateCompanyDto } from './dto/update-company.dto';
import { CompanyBusinessSector } from './models/company-business-sector.model';
import { CompanyInvitation } from './models/company-invitation.model';
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

  async findOne(companyId: string) {
    return this.companyModel.findOne({
      where: { id: companyId },
      attributes: [
        'id',
        'createdAt',
        'name',
        'description',
        'url',
        'hiringUrl',
        'linkedInUrl',
      ],
      order: [['name', 'ASC']],
    });
  }

  async findOneComplete(companyId: string) {
    return this.companyModel.findOne({
      where: { id: companyId },
      include: [
        {
          model: User,
          as: 'users',
          include: [
            {
              model: CompanyInvitation,
              as: 'invitations',
            },
            {
              model: Conversation,
              as: 'conversations',
              attributes: ['id'],
              through: {
                attributes: [],
                as: 'conversationParticipants',
              },
            },
          ],
          through: {
            attributes: ['isAdmin', 'role'],
            as: 'companyUsers',
          },
        },
        {
          model: CompanyInvitation,
          as: 'pendingInvitations',
          where: {
            userId: null, // Only include invitations that have not been accepted
          },
          required: false,
        },
      ],
      order: [['name', 'ASC']],
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
