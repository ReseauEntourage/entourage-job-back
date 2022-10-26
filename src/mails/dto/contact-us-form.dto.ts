import { ApiProperty } from '@nestjs/swagger';
import { IsBoolean, IsOptional, IsString } from "class-validator";
import { HeardAbout } from '../mails.types';
import { IsBefore } from "sequelize-typescript";

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
  phone?: string;

  @ApiProperty()
  @IsString()
  email: string;

  @ApiProperty()
  @IsString()
  @IsOptional()
  structure?: string;

  @ApiProperty()
  @IsString()
  message: string;

  @ApiProperty()
  @IsString()
  @IsOptional()
  heardAbout?: HeardAbout;

  @ApiProperty()
  @IsBoolean()
  cgu: boolean;
}
