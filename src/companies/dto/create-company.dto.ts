import { IntersectionType, PickType } from '@nestjs/swagger';
import { Company } from '../models/company.model';

export class CreateCompanyDto extends IntersectionType(
  PickType(Company, ['name'] as const)
) {}
