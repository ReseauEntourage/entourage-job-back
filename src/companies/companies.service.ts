import fs from 'fs';
import { Injectable, NotFoundException } from '@nestjs/common';
import { InjectModel } from '@nestjs/sequelize';
import { Op } from 'sequelize';
import { Department } from 'src/common/locations/locations.types';
import { S3Service } from 'src/external-services/aws/s3.service';
import { SlackService } from 'src/external-services/slack/slack.service';
import { slackChannels } from 'src/external-services/slack/slack.types';
import { User } from 'src/users/models';
import {
  getAdminMailsFromZone,
  searchInColumnWhereOption,
} from 'src/utils/misc';
import { companiesAttributes } from './companies.attributes';
import { companiesWithUsers } from './companies.includes';
import { CompanyCreationContext } from './companies.types';
import { generateSlackMsgConfigNewCompany } from './companies.utils';
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
    private readonly s3Service: S3Service,
    private readonly slackService: SlackService
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
      include: companiesWithUsers({ departments, businessSectorIds }),
      attributes: companiesAttributes,
      where: {
        [Op.and]: [
          ...(search
            ? [searchInColumnWhereOption('Company.name', search)]
            : []),
          {
            id: {
              [Op.in]: this.companyModel.sequelize.literal(
                '(SELECT "companyId" FROM "CompanyUsers" WHERE "isAdmin" = true)'
              ),
            },
          },
        ],
      },
      ...(limit ? { limit } : {}),
      ...(offset ? { offset } : {}),
      order: [['name', 'ASC']],
    });
  }

  async findOrCreateByName(
    name: string,
    user: Pick<User, 'email' | 'firstName' | 'lastName' | 'zone'>,
    context: CompanyCreationContext = CompanyCreationContext.UNKNOWN
  ) {
    const company = await this.companyModel.findOne({
      where: { name },
      attributes: companiesAttributes,
    });
    if (company) {
      return company;
    }
    return this.create({ name }, user, context);
  }

  async create(
    createCompanyDto: Partial<Company>,
    createdByUser: Pick<User, 'email' | 'firstName' | 'lastName' | 'zone'>,
    context: CompanyCreationContext = CompanyCreationContext.UNKNOWN
  ) {
    const company = await this.companyModel.create(createCompanyDto, {
      hooks: true,
    });

    const { candidatesAdminMail } = getAdminMailsFromZone(createdByUser.zone);
    const referentSlackUserId = await this.slackService.getUserIdByEmail(
      candidatesAdminMail
    );

    this.sendSlackNotificationCompanyCreated(
      company,
      createdByUser,
      referentSlackUserId,
      context
    );
    return company;
  }

  async findOne(companyId: string) {
    return this.companyModel.findOne({
      where: { id: companyId },
      attributes: companiesAttributes,
      include: companiesWithUsers({}),
    });
  }

  async findOneWithCompanyUsersAndPendingInvitations(
    companyId: string,
    asCompanyAdmin: boolean
  ) {
    return this.companyModel.findOne({
      where: { id: companyId },
      include: companiesWithUsers({ asCompanyAdmin }),
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

  async sendSlackNotificationCompanyCreated(
    company: Company,
    user: Pick<User, 'email' | 'firstName' | 'lastName'>,
    referentSlackUserId: string | null,
    context: CompanyCreationContext = CompanyCreationContext.UNKNOWN
  ) {
    const slackMsgConfig = generateSlackMsgConfigNewCompany(
      company,
      user,
      referentSlackUserId,
      context
    );
    const slackBlocks = this.slackService.generateSlackBlockMsg(slackMsgConfig);
    return this.slackService.sendMessage(
      slackChannels.ENTOURAGE_PRO_MODERATION,
      slackBlocks,
      'Nouvelle entreprise créée : ' + company.name
    );
  }
}
