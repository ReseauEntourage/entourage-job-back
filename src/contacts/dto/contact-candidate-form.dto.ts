import { ApiProperty } from '@nestjs/swagger';
import {
  IsArray,
  IsBoolean,
  IsOptional,
  IsPostalCode,
  IsString,
} from 'class-validator';
import { BusinessLineValue } from 'src/common/businessLines/businessLines.types';
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
import { BusinessLine } from "src/common/businessLines/models"

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
  gender: CandidateGender;

  @ApiProperty()
  @IsString()
  @IsOptional()
  birthDate?: Date;

  @ApiProperty()
  @IsString()
  @IsOptional()
  address?: string;

  @ApiProperty()
  @IsPostalCode('FR')
  postalCode: string;

  @ApiProperty()
  @IsString()
  city: string;

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
  businessLines?: BusinessLineValue[];

  @ApiProperty()
  @IsString()
  description: string;

  @ApiProperty()
  @IsString()
  heardAbout: HeardAboutValue;

  @ApiProperty()
  @IsString()
  @IsOptional()
  diagnostic?: string;

  @ApiProperty()
  @IsBoolean()
  @IsOptional()
  contactWithCoach?: boolean;
}
