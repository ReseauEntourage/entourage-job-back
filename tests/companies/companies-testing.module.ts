import { Module } from '@nestjs/common';
import { CompaniesModule } from 'src/companies/companies.module';
import { CompaniesHelper } from './companies.helper';
import { CompanyFactory } from './company.factory';

@Module({
  imports: [CompaniesModule],
  providers: [CompanyFactory, CompaniesHelper],
  exports: [CompanyFactory, CompaniesHelper],
})
export class CompaniesTestingModule {}
