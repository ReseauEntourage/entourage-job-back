import { ApiProperty } from '@nestjs/swagger';
import { IsOptional, IsPostalCode, IsString, Length } from 'class-validator';
import {
  CandidateAccommodation,
  CandidateAdministrativeSituation,
  CandidateNationality,
  CandidateYesNoValue,
} from 'src/contacts/contacts.types';

export class ContactCandidateFormDto {
  @ApiProperty()
  @IsString()
  firstName: string;

  @ApiProperty()
  @IsString()
  lastName: string;

  @ApiProperty()
  @IsString()
  email: string;

  @ApiProperty()
  @IsString()
  phone: string;

  @ApiProperty()
  @IsPostalCode('FR')
  postalCode: string;

  @ApiProperty()
  @IsString()
  birthDate: string;

  @ApiProperty()
  @IsString()
  structure: string;

  @ApiProperty()
  @IsString()
  structureAddress: string;

  @ApiProperty()
  @IsString()
  workerFirstName: string;

  @ApiProperty()
  @IsString()
  workerLastName: string;

  @ApiProperty()
  @IsString()
  workerPhone: string;

  @ApiProperty()
  @IsString()
  workerEmail: string;

  @ApiProperty()
  @IsString()
  nationality: CandidateNationality;

  @ApiProperty()
  @IsString()
  administrativeSituation: CandidateAdministrativeSituation;

  @ApiProperty()
  @IsString()
  workingRight: CandidateYesNoValue;

  @ApiProperty()
  @IsString()
  accommodation: CandidateAccommodation;

  @ApiProperty()
  @IsString()
  domiciliation: CandidateYesNoValue;

  @ApiProperty()
  @IsString()
  socialSecurity: CandidateYesNoValue;

  @ApiProperty()
  @IsString()
  bankAccount: CandidateYesNoValue;

  @ApiProperty()
  @IsString()
  @Length(1, 256)
  diagnostic: string;

  @ApiProperty()
  @IsString()
  @IsOptional()
  comment: string;
}
