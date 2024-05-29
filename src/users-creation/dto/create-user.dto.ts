import { ApiProperty, PickType } from '@nestjs/swagger';
import { IsOptional } from 'class-validator';
import { User } from 'src/users/models';

export class CreateUserDto extends PickType(User, [
  'OrganizationId',
  'firstName',
  'lastName',
  'email',
  'role',
  'adminRole',
  'gender',
  'phone',
  'address',
  'zone',
  'isEmailVerified',
] as const) {
  @ApiProperty()
  @IsOptional()
  userToLinkId?: string | string[];
}
