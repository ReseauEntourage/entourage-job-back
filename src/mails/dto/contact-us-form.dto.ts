import { IsOptional, IsString } from 'class-validator';
import { HeardAboutValue } from '../mails.types';
import { ApiProperty } from '@nestjs/swagger';

export class ContactUsFormDto {
  @ApiProperty()
  @IsString()
  firstName: string;

  @ApiProperty()
  @IsString()
  lastName: string;

  @ApiProperty()
  @IsString()
  @IsOptional()
  phone: string;

  @ApiProperty()
  @IsString()
  email: string;

  @ApiProperty()
  @IsString()
  @IsOptional()
  structure: string;

  @ApiProperty()
  @IsString()
  message: string;

  @ApiProperty()
  @IsString()
  @IsOptional()
  heardAbout: HeardAboutValue;
}
