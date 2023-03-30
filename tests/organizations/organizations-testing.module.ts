import { Module } from '@nestjs/common';
import { OrganizationsModule } from 'src/organizations/organizations.module';
import { UsersModule } from 'src/users/users.module';
import { OrganizationFactory } from './organization.factory';
import { OrganizationsHelper } from './organizations.helper';

@Module({
  imports: [UsersModule, OrganizationsModule],
  providers: [OrganizationFactory, OrganizationsHelper],
  exports: [OrganizationFactory, OrganizationsHelper],
})
export class OrganizationsTestingModule {}
