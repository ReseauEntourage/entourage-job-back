import { IsArray, IsEnum, IsOptional, IsString } from 'class-validator';
import type { UserRole } from 'src/users/users.types';
import { UserRoles } from 'src/users/users.types';

export class GetPreRegistrationCompatibleProfilesDto {
  @IsEnum(UserRoles)
  role: UserRole;

  @IsOptional()
  @IsArray()
  @IsString({ each: true })
  nudgeIds?: string[];

  @IsOptional()
  @IsArray()
  @IsString({ each: true })
  businessSectorIds?: string[];
}
