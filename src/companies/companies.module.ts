import { Module } from '@nestjs/common';
import { SequelizeModule } from '@nestjs/sequelize';
import { CompaniesController } from './companies.controller';
import { CompaniesService } from './companies.service';
import { CompanyUser } from './models/company-user.model';
import { CompanyUsersService } from './models/company-user.service';
import { Company } from './models/company.model';

@Module({
  imports: [SequelizeModule.forFeature([Company, CompanyUser])],
  controllers: [CompaniesController],
  providers: [CompaniesService, CompanyUsersService],
  exports: [CompaniesService, CompanyUsersService],
})
export class CompaniesModule {}
