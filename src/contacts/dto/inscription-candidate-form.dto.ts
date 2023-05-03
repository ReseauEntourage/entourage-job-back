import { ApiProperty } from '@nestjs/swagger';
import { IsOptional, IsString } from 'class-validator';
import {
  CandidateYesNoNSPPValue,
  HeardAboutValue,
} from 'src/contacts/contacts.types';

export class InscriptionCandidateFormDto {
  @ApiProperty()
  @IsString()
  birthdate: Date;

  @ApiProperty()
  @IsString()
  email: string;

  @ApiProperty()
  @IsString()
  firstName: string;

  @ApiProperty()
  @IsString()
  heardAbout: HeardAboutValue;

  @ApiProperty()
  @IsString()
  @IsOptional()
  infoCo: string;

  @ApiProperty()
  @IsString()
  lastName: string;

  @ApiProperty()
  @IsString()
  location: string;

  @ApiProperty()
  @IsString()
  phone: string;

  @ApiProperty()
  @IsString()
  workingRight: CandidateYesNoNSPPValue;
}
