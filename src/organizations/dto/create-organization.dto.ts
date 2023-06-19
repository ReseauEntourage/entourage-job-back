import { IntersectionType, PickType } from '@nestjs/swagger';
import { Organization } from '../models';
import { OrganizationReferent } from '../models/organization-referent.model';

export class CreateOrganizationDto extends IntersectionType(
  PickType(Organization, ['name', 'address', 'zone'] as const),
  PickType(OrganizationReferent, [
    'referentFirstName',
    'referentLastName',
    'referentMail',
    'referentPhone',
  ] as const)
) {}
