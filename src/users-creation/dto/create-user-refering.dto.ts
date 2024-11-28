import { ApiProperty, PickType } from '@nestjs/swagger';
import { IsArray, IsNumber, IsOptional, IsString } from 'class-validator';
import { Ambition } from 'src/common/ambitions/models';
import { BusinessLine } from 'src/common/business-lines/models';
import { Department } from 'src/common/locations/locations.types';
import {
  CandidateAccommodation,
  CandidateResource,
  CandidateYesNoNSPPValue,
  JobSearchDuration,
  Nationality,
  StudiesLevel,
  WorkingExperience,
  YesNoJNSPRValue,
} from 'src/contacts/contacts.types';
import { HelpNeed } from 'src/user-profiles/models';
import { User } from 'src/users/models';
import { Gender, Program } from 'src/users/users.types';

export class CreateUserReferingDto extends PickType(User, [
  'firstName',
  'lastName',
  'email',
  'gender',
  'phone',
  'password',
] as const) {
  @ApiProperty()
  @IsNumber()
  gender: Gender;

  @ApiProperty()
  @IsString()
  program: Program;

  @ApiProperty()
  @IsString()
  birthDate: Date;

  @ApiProperty()
  @IsString()
  department: Department;

  @ApiProperty()
  @IsString()
  @IsOptional()
  campaign?: string;

  @ApiProperty()
  @IsArray()
  helpNeeds?: HelpNeed[];

  @ApiProperty()
  @IsString()
  workingRight?: CandidateYesNoNSPPValue;

  @ApiProperty()
  @IsArray()
  @IsOptional()
  searchBusinessLines?: BusinessLine[];

  @ApiProperty()
  @IsArray()
  @IsOptional()
  searchAmbitions?: Ambition[];

  @ApiProperty()
  @IsString()
  @IsOptional()
  nationality?: Nationality;

  @ApiProperty()
  @IsString()
  @IsOptional()
  accommodation?: CandidateAccommodation;

  @ApiProperty()
  @IsString()
  @IsOptional()
  hasSocialWorker?: YesNoJNSPRValue;

  @ApiProperty()
  @IsString()
  @IsOptional()
  resources?: CandidateResource;

  @ApiProperty()
  @IsString()
  @IsOptional()
  studiesLevel?: StudiesLevel;

  @ApiProperty()
  @IsString()
  @IsOptional()
  workingExperience?: WorkingExperience;

  @ApiProperty()
  @IsString()
  @IsOptional()
  jobSearchDuration?: JobSearchDuration;
}
