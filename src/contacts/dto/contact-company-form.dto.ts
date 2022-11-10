import { ApiProperty } from '@nestjs/swagger';
import { IsArray, IsOptional, IsString } from 'class-validator';
import { CompanyApproach, HeardAboutValue } from 'src/contacts/contacts.types';
import { AdminZone } from 'src/utils/types';

export class ContactCompanyFormDto {
  @ApiProperty()
  @IsString()
  firstName: string;

  @ApiProperty()
  @IsString()
  lastName: string;

  @ApiProperty()
  @IsString()
  approach: CompanyApproach;

  @ApiProperty()
  @IsString()
  email: string;

  @ApiProperty()
  @IsString()
  company: string;

  @ApiProperty()
  @IsArray()
  zones: AdminZone[];

  @ApiProperty()
  @IsString()
  @IsOptional()
  phone?: string;

  @ApiProperty()
  @IsString()
  @IsOptional()
  heardAbout?: HeardAboutValue;
}
