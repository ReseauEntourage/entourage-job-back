import { ApiProperty, PickType } from '@nestjs/swagger';
import { IsArray, IsDate, IsOptional, IsString } from 'class-validator';
import { Department } from 'src/common/locations/locations.types';
import { HelpNeed } from 'src/user-profiles/models';
import { User } from 'src/users/models';
import { NormalUserRole, Program } from 'src/users/users.types';

export class CreateUserRegistrationDto extends PickType(User, [
  'firstName',
  'lastName',
  'email',
  'role',
  'gender',
  'phone',
  'password',
] as const) {
  @ApiProperty()
  @IsString()
  role: NormalUserRole;

  @ApiProperty()
  @IsString()
  password: string;

  @ApiProperty()
  @IsString()
  program: Program;

  @ApiProperty()
  @IsDate()
  birthDate: Date;

  @ApiProperty()
  @IsString()
  department: Department;

  @ApiProperty()
  @IsString()
  @IsOptional()
  campaign?: string;

  @ApiProperty()
  @IsArray()
  @IsOptional()
  helpNeeds?: HelpNeed[];

  @ApiProperty()
  @IsString()
  @IsOptional()
  workingRight?: string;
}
