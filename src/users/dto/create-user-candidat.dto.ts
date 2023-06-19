import { PickType } from '@nestjs/swagger';
import { UserCandidat } from '../models';

export class CreateUserCandidatDto extends PickType(UserCandidat, [
  'employed',
  'contract',
  'endOfContract',
  'hidden',
  'note',
] as const) {}
