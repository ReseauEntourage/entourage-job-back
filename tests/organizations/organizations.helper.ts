import { Injectable } from '@nestjs/common';
import { CreateOrganizationDto } from 'src/organizations/dto';
import { Organization } from 'src/organizations/models';

@Injectable()
export class OrganizationsHelper {
  mapOrganizationProps(organization: Organization): CreateOrganizationDto {
    return {
      name: organization.name,
      address: organization.address,
      zone: organization.zone,
      referentFirstName: organization.organizationReferent.referentFirstName,
      referentLastName: organization.organizationReferent.referentLastName,
      referentMail: organization.organizationReferent.referentMail,
      referentPhone: organization.organizationReferent.referentPhone,
    };
  }
}
