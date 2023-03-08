import { Module } from '@nestjs/common';
import { OrganizationsModule } from 'src/organizations/organizations.module';
import { UsersModule } from 'src/users/users.module';
import { OrganizationFactory } from './organization.factory';

@Module({
  imports: [UsersModule, OrganizationsModule],
  providers: [OrganizationFactory],
  exports: [OrganizationFactory],
})
export class OrganizationsTestingModule {}
