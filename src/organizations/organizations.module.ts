import { Module } from '@nestjs/common';
import { SequelizeModule } from '@nestjs/sequelize';
import { Organization } from './models';
import { OrganizationReferent } from './models/organization-referent.model';
import { OrganizationReferentsService } from './organization-referents.service';
import { OrganizationsController } from './organizations.controller';
import { OrganizationsService } from './organizations.service';

@Module({
  imports: [SequelizeModule.forFeature([Organization, OrganizationReferent])],
  controllers: [OrganizationsController],
  providers: [OrganizationsService, OrganizationReferentsService],
  exports: [SequelizeModule, OrganizationsService],
})
export class OrganizationsModule {}
