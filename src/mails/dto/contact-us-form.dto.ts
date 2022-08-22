import { IsOptional, IsString } from 'class-validator';
import { HeardAboutValue } from '../mails.types';

export class ContactUsFormDto {
  @IsString()
  firstName: string;

  @IsString()
  lastName: string;

  @IsString()
  @IsOptional()
  phone: string;

  @IsString()
  email: string;

  @IsString()
  @IsOptional()
  structure: string;

  @IsString()
  message: string;

  @IsString()
  @IsOptional()
  heardAbout: HeardAboutValue;
}
