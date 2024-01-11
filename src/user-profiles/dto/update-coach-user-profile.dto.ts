import { PartialType } from '@nestjs/swagger';
import { CreateCoachUserProfileDto } from './create-coach-user-profile.dto';

export class UpdateCoachUserProfileDto extends PartialType(
  CreateCoachUserProfileDto
) {}
