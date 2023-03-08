import { PickType } from '@nestjs/swagger';
import { Organization } from '../models';

export class CreateOrganizationDto extends PickType(Organization, [
  'name',
  'address',
  'referentFirstName',
  'referentLastName',
  'referentMail',
  'referentPhone',
  'zone',
] as const) {}
