import { Transform } from 'class-transformer';
import { IsArray, IsEnum, IsOptional, IsString } from 'class-validator';
import type { UserRole } from 'src/users/users.types';
import { UserRoles } from 'src/users/users.types';

const toArray = ({ value }: { value: unknown }) =>
  Array.isArray(value) ? value : value !== undefined ? [value] : undefined;

export class GetPreRegistrationCompatibleProfilesDto {
  @IsEnum(UserRoles)
  role: UserRole;

  @IsOptional()
  @IsArray()
  @IsString({ each: true })
  @Transform(toArray)
  nudgeIds?: string[];

  @IsOptional()
  @IsArray()
  @IsString({ each: true })
  @Transform(toArray)
  businessSectorIds?: string[];
}
