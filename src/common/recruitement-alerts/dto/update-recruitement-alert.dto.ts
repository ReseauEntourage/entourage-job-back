import { PartialType } from '@nestjs/swagger';
import { CreateRecruitementAlertDto } from './create-recruitement-alert.dto';

export class UpdateRecruitementAlertDto extends PartialType(
  CreateRecruitementAlertDto
) {}
