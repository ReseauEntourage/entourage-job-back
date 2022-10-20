import { PartialType } from '@nestjs/swagger';
import { CreateOpportunityUserDto } from './create-opportunity-user.dto';

export class UpdateOpportunityUserDto extends PartialType(
  CreateOpportunityUserDto
) {}
