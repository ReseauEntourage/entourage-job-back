import { ApiProperty } from '@nestjs/swagger';
import { IsArray, IsOptional, IsString } from 'class-validator';
import {
  CompanyApproach,
  CompanyZone,
  HeardAboutValue,
} from 'src/contacts/contacts.types';

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
  zones: CompanyZone[];

  @ApiProperty()
  @IsString()
  @IsOptional()
  phone?: string;

  @ApiProperty()
  @IsString()
  @IsOptional()
  heardAbout?: HeardAboutValue;
}
