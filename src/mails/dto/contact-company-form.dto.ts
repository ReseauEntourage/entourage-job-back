import { ApiProperty } from '@nestjs/swagger';
import { IsArray, IsOptional, IsString } from 'class-validator';
import { CompanyApproach, HeardAbout } from '../mails.types';
import { AdminZone } from 'src/utils/types';

export class ContactCompanyFormDto {
  @ApiProperty()
  @IsString()
  firstName: string;

  @ApiProperty()
  @IsString()
  lastName: string;

  @ApiProperty()
  @IsArray()
  approach: CompanyApproach[];

  @ApiProperty()
  @IsString()
  email: string;

  @ApiProperty()
  @IsString()
  company: string;

  @ApiProperty()
  @IsArray()
  regions: AdminZone[];

  @ApiProperty()
  @IsString()
  @IsOptional()
  phone?: string;

  @ApiProperty()
  @IsString()
  @IsOptional()
  heardAbout?: HeardAbout;
}
