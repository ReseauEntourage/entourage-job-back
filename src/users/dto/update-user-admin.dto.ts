import { PartialType, PickType } from '@nestjs/swagger';
import { UpdateUserDto } from './update-user.dto';

export class UpdateUserAdminDto extends PartialType(
  PickType(UpdateUserDto, [
    'firstName',
    'lastName',
    'email',
    'phone',
    'gender',
    'zone',
    'role',
    'OrganizationId',
    'onboardingStatus',
    'onboardingWebinarSkippedAt',
  ] as const)
) {}
