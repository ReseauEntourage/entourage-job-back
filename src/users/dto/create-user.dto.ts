import { ApiProperty, PickType } from '@nestjs/swagger';
import { IsOptional } from 'class-validator';
import { User } from '../models';

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
] as const) {
  @ApiProperty()
  @IsOptional()
  linkedUser?: string | string[];
}
