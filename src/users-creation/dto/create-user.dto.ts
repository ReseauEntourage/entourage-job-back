import { PickType } from '@nestjs/swagger';
import { User } from 'src/users/models';

export class CreateUserDto extends PickType(User, [
  'OrganizationId',
  'firstName',
  'lastName',
  'email',
  'role',
  'gender',
  'phone',
  'address',
  'zone',
] as const) {}
