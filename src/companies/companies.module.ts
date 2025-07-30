import { Module } from '@nestjs/common';
import { SequelizeModule } from '@nestjs/sequelize';
import { AWSModule } from 'src/external-services/aws/aws.module';
import { MailsModule } from 'src/mails/mails.module';
import { UsersModule } from 'src/users/users.module';
import { CompaniesController } from './companies.controller';
import { CompaniesService } from './companies.service';
import { CompanyBusinessSector } from './models/company-business-sector.model';
import { CompanyUser } from './models/company-user.model';
import { CompanyUsersService } from './models/company-user.service';
import { Company } from './models/company.model';

@Module({
  imports: [
    SequelizeModule.forFeature([Company, CompanyUser, CompanyBusinessSector]),
    MailsModule,
    UsersModule,
    AWSModule,
  ],
  controllers: [CompaniesController],
  providers: [CompaniesService, CompanyUsersService],
  exports: [CompaniesService, CompanyUsersService],
})
export class CompaniesModule {}
