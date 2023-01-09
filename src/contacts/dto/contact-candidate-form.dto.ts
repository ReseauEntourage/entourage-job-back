import { ApiProperty } from '@nestjs/swagger';
import {
  IsArray,
  IsBoolean,
  IsOptional,
  IsPostalCode,
  IsString,
} from 'class-validator';
import { BusinessLine } from 'src/common/businessLines/models';
import {
  CandidateAccommodation,
  CandidateAdministrativeSituation,
  CandidateGender,
  CandidateHelpWithValue,
  CandidateProfessionalSituation,
  CandidateResource,
  CandidateYesNoValue,
  HeardAboutValue,
} from 'src/contacts/contacts.types';

export class ContactCandidateFormDto {
  @ApiProperty()
  @IsString()
  workerFirstName: string;

  @ApiProperty()
  @IsString()
  workerLastName: string;

  @ApiProperty()
  @IsString()
  structure: string;

  @ApiProperty()
  @IsString()
  @IsOptional()
  workerPosition?: string;

  @ApiProperty()
  @IsString()
  workerEmail: string;

  @ApiProperty()
  @IsString()
  workerPhone: string;

  @ApiProperty()
  @IsString()
  firstName: string;

  @ApiProperty()
  @IsString()
  lastName: string;

  @ApiProperty()
  @IsArray()
  helpWith: CandidateHelpWithValue[];

  @ApiProperty()
  @IsString()
  gender: CandidateGender[];

  @ApiProperty()
  @IsString()
  @IsOptional()
  birthDate?: Date;

  @ApiProperty()
  @IsString()
  address?: Date;

  @ApiProperty()
  @IsPostalCode('FR')
  postalCode: string;

  @ApiProperty()
  @IsString()
  city?: Date;

  @ApiProperty()
  @IsString()
  phone: string;

  @ApiProperty()
  @IsString()
  @IsOptional()
  email?: string;

  @ApiProperty()
  @IsString()
  registeredUnemploymentOffice: CandidateYesNoValue;

  @ApiProperty()
  @IsString()
  @IsOptional()
  administrativeSituation?: CandidateAdministrativeSituation;

  @ApiProperty()
  @IsString()
  workingRight: CandidateYesNoValue;

  @ApiProperty()
  @IsString()
  accommodation: CandidateAccommodation;

  @ApiProperty()
  @IsString()
  professionalSituation: CandidateProfessionalSituation;

  @ApiProperty()
  @IsString()
  @IsOptional()
  resources?: CandidateResource;

  @ApiProperty()
  @IsString()
  domiciliation: CandidateYesNoValue;

  @ApiProperty()
  @IsString()
  socialSecurity: CandidateYesNoValue;

  @ApiProperty()
  @IsString()
  @IsOptional()
  handicapped?: CandidateYesNoValue;

  @ApiProperty()
  @IsString()
  bankAccount: CandidateYesNoValue;

  @ApiProperty()
  @IsArray()
  @IsOptional()
  businessLines?: BusinessLine[];

  @ApiProperty()
  @IsString()
  description: string;

  @ApiProperty()
  @IsString()
  heardAbout: HeardAboutValue;

  @ApiProperty()
  @IsString()
  diagnostic: string;

  @ApiProperty()
  @IsBoolean()
  @IsOptional()
  stayInformed: boolean;

  @ApiProperty()
  @IsBoolean()
  @IsOptional()
  contactWithCoach: boolean;
}
