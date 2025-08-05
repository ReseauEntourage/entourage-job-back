import { Injectable } from '@nestjs/common';
import { InjectModel } from '@nestjs/sequelize';
import { MailsService } from 'src/mails/mails.service';
import { User } from 'src/users/models';
import { CompaniesService } from './companies.service';
import { CompanyInvitation } from './models/company-invitation.model';
import { Company } from './models/company.model';

@Injectable()
export class CompanyInvitationsService {
  constructor(
    @InjectModel(CompanyInvitation)
    private readonly companyInvitationModel: typeof CompanyInvitation,
    private readonly companiesService: CompaniesService,
    private readonly mailsService: MailsService
  ) {}

  async findOneById(id: string) {
    return this.companyInvitationModel.findOne({
      where: { id },
      include: [
        { model: User, as: 'user' },
        { model: User, as: 'author' },
        { model: Company, as: 'company' },
      ],
    });
  }

  async update(
    id: string,
    updateData: Partial<CompanyInvitation>
  ): Promise<CompanyInvitation> {
    const invitation = await this.findOneById(id);
    if (!invitation) {
      throw new Error(`Invitation with ID ${id} not found`);
    }
    await this.companyInvitationModel.update(updateData, {
      where: { id },
    });
    return this.findOneById(id);
  }

  async inviteCollaborators(sender: User, companyId: string, emails: string[]) {
    // Validate input
    if (emails.length === 0) {
      throw new Error('No emails provided for invitation');
    }

    // Validate company existence
    const company = await this.companiesService.findOneCompany(companyId);
    if (!company) {
      throw new Error(`Company with ID ${companyId} not found`);
    }

    // Create invitations for each email and send emails
    for (const email of emails) {
      await this.companyInvitationModel.sequelize.transaction(
        async (transaction) => {
          const invitation = await this.companyInvitationModel.create(
            {
              companyId: company.id,
              email,
              authorId: sender.id,
            },
            { transaction, hooks: true }
          );

          const invitationWithCompany =
            await this.companyInvitationModel.findOne({
              where: { id: invitation.id },
              include: [{ model: Company }],
              transaction,
            });
          await this.mailsService.sendCompanyInvitation({
            email,
            sender,
            invitationWithCompany,
          });
        }
      );
    }
  }
}
