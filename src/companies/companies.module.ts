import { Module } from '@nestjs/common';
import { SequelizeModule } from '@nestjs/sequelize';
import { CompaniesController } from './companies.controller';
import { CompaniesService } from './companies.service';
import { CompanyUser } from './models/company-user.model';
import { Company } from './models/company.model';

@Module({
  imports: [SequelizeModule.forFeature([Company, CompanyUser])],
  controllers: [CompaniesController],
  providers: [CompaniesService],
  exports: [CompaniesService],
})
export class CompaniesModule {}
