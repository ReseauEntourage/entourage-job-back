import { Module } from '@nestjs/common';
import { CompaniesModule } from 'src/companies/companies.module';
import { DepartmentsTestingModule } from 'tests/departments/departments-testing.module';
import { CompaniesHelper } from './companies.helper';
import { CompanyFactory } from './company.factory';

@Module({
  imports: [CompaniesModule, DepartmentsTestingModule],
  providers: [CompanyFactory, CompaniesHelper],
  exports: [CompanyFactory, CompaniesHelper],
})
export class CompaniesTestingModule {}
