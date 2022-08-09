import { IsOptional, IsString } from 'class-validator';

export class UpdateUserRestrictedDto {
  @IsOptional()
  @IsString()
  email: string;

  @IsOptional()
  @IsString()
  phone: string;

  @IsOptional()
  @IsString()
  address: string;
}
