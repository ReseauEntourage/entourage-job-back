import { Injectable } from '@nestjs/common';
import { InjectModel } from '@nestjs/sequelize';
import { Conversation } from 'src/messaging/models';
import { User } from 'src/users/models';
import { searchInColumnWhereOption } from 'src/utils/misc';
import { CompanyInvitation } from './models/company-invitation.model';
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
}
