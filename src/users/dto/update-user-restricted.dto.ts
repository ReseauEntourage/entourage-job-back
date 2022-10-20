import { PartialType, PickType } from '@nestjs/swagger';
import { UpdateUserDto } from './update-user.dto';

export class UpdateUserRestrictedDto extends PartialType(
  PickType(UpdateUserDto, ['email', 'phone', 'address'] as const)
) {}
