import { IntersectionType, PickType } from '@nestjs/swagger';
import { Organization, OrganizationReferent } from '../models';

export class CreateOrganizationDto extends IntersectionType(
  PickType(Organization, ['name', 'address', 'zone'] as const),
  PickType(OrganizationReferent, [
    'referentFirstName',
    'referentLastName',
    'referentMail',
    'referentPhone',
  ] as const)
) {}
