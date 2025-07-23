import { Injectable } from '@nestjs/common';
import { InjectModel } from '@nestjs/sequelize';
import { MailsService } from 'src/mails/mails.service';
import { User } from 'src/users/models';
import { searchInColumnWhereOption } from 'src/utils/misc';
import { InviteCollaboratorsDto } from './dto/invite-collaborators.dto';
import { Company } from './models/company.model';

@Injectable()
export class CompaniesService {
  constructor(
    @InjectModel(Company)
    private companyModel: typeof Company,
    private readonly mailsService: MailsService
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

    // Logic to handle inviting collaborators, e.g., sending emails
    // This is a placeholder implementation
    return {
      message: 'Invitations sent successfully',
      emails: inviteCollaboratorsDto.emails,
    };
  }
}
