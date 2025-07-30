import { Module } from '@nestjs/common';
import { SequelizeModule } from '@nestjs/sequelize';
import { MailsModule } from 'src/mails/mails.module';
import { CompaniesController } from './companies.controller';
import { CompaniesService } from './companies.service';
import { CompanyInvitationsService } from './company-invitations.service';
import { CompanyUsersService } from './company-user.service';
import { CompanyInvitation } from './models/company-invitation.model';
import { CompanyUser } from './models/company-user.model';
import { Company } from './models/company.model';

@Module({
  imports: [
    SequelizeModule.forFeature([Company, CompanyUser, CompanyInvitation]),
    MailsModule,
  ],
  controllers: [CompaniesController],
  providers: [CompaniesService, CompanyUsersService, CompanyInvitationsService],
  exports: [CompaniesService, CompanyUsersService, CompanyInvitationsService],
})
export class CompaniesModule {}
