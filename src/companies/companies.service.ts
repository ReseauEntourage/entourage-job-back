import fs from 'fs';
import { Injectable, NotFoundException } from '@nestjs/common';
import { InjectModel } from '@nestjs/sequelize';
import { Op } from 'sequelize';
// eslint-disable-next-line @typescript-eslint/no-unused-vars
import { S3Service } from 'src/external-services/aws/s3.service';
import { MailsService } from 'src/mails/mails.service';
import { User } from 'src/users/models';
import { searchInColumnWhereOption } from 'src/utils/misc';
import { InviteCollaboratorsDto } from './dto/invite-collaborators.dto';
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
    private readonly mailsService: MailsService,
    private readonly S3Service: S3Service
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

  async findOneCompany(companyId: string) {
    return this.companyModel.findOne({
      where: { id: companyId },
      order: [['name', 'ASC']],
    });
  }

  async inviteCollaborators(
    sender: User,
    companyId: string,
    inviteCollaboratorsDto: InviteCollaboratorsDto
  ) {
    const company = await this.findOneCompany(companyId);
    if (!company) {
      throw new Error(`Company with ID ${companyId} not found`);
    }
    if (
      !inviteCollaboratorsDto.emails ||
      inviteCollaboratorsDto.emails.length === 0
    ) {
      throw new Error('No emails provided for invitation');
    }

    this.mailsService.sendCompanyInvitationToCollaborators(
      sender,
      company,
      inviteCollaboratorsDto
    );
  }

  async update(
    id: string,
    updateCompanyDto: UpdateCompanyDto
  ): Promise<Company> {
    const company = await this.findOneCompany(id);

    if (!company) {
      throw new NotFoundException(`Company with ID ${id} not found`);
    }

    await this.companyModel.update(updateCompanyDto, {
      where: { id },
      returning: true,
    });

    return this.findOneCompany(id);
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
      const s3file = await this.S3Service.upload(
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
    const company = await this.findOneCompany(companyId);

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
