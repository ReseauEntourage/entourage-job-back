import { Module } from '@nestjs/common';
import { SequelizeModule } from '@nestjs/sequelize';
import { DepartmentsModule } from 'src/common/departments/departments.module';
import { AWSModule } from 'src/external-services/aws/aws.module';
import { MailsModule } from 'src/mails/mails.module';
import { UsersModule } from 'src/users/users.module';
import { CompaniesController } from './companies.controller';
import { CompaniesService } from './companies.service';
import { CompanyInvitationsService } from './company-invitations.service';
import { CompanyUsersService } from './company-user.service';
import { CompanyBusinessSector } from './models/company-business-sector.model';
import { CompanyInvitation } from './models/company-invitation.model';
import { CompanyUser } from './models/company-user.model';
import { Company } from './models/company.model';

@Module({
  imports: [
    SequelizeModule.forFeature([
      Company,
      CompanyUser,
      CompanyInvitation,
      CompanyBusinessSector,
    ]),
    MailsModule,
    UsersModule,
    AWSModule,
    DepartmentsModule,
  ],
  controllers: [CompaniesController],
  providers: [CompaniesService, CompanyUsersService, CompanyInvitationsService],
  exports: [
    SequelizeModule,
    CompaniesService,
    CompanyUsersService,
    CompanyInvitationsService,
  ],
})
export class CompaniesModule {}
