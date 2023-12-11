import { PartialType } from '@nestjs/swagger';
import { CreateCandidateUserProfileDto } from './create-candidate-user-profile.dto';

export class UpdateCandidateUserProfileDto extends PartialType(
  CreateCandidateUserProfileDto
) {}
