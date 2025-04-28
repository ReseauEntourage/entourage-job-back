import { ApiProperty, PickType } from '@nestjs/swagger';
import {
  IsArray,
  IsBoolean,
  IsNumber,
  IsOptional,
  IsString,
} from 'class-validator';
import { Ambition } from 'src/common/ambitions/models';
import { BusinessLine } from 'src/common/business-lines/models';
import { Department } from 'src/common/locations/locations.types';
import {
  CandidateYesNoNSPPValue,
  CandidateYesNoValue,
} from 'src/contacts/contacts.types';
import { HelpNeed } from 'src/user-profiles/models';
import { User } from 'src/users/models';
import { Gender, Program, RegistrableUserRole } from 'src/users/users.types';

export class CreateUserRegistrationDto extends PickType(User, [
  'firstName',
  'lastName',
  'email',
  'role',
  'gender',
  'phone',
  'password',
] as const) {
  @ApiProperty()
  @IsNumber()
  @IsOptional()
  gender: Gender;

  @ApiProperty()
  @IsString()
  role: RegistrableUserRole;

  @ApiProperty()
  @IsString()
  password: string;

  @ApiProperty()
  @IsString()
  @IsOptional()
  program: Program;

  @ApiProperty()
  @IsString()
  @IsOptional()
  birthDate: Date;

  @ApiProperty()
  @IsString()
  department: Department;

  @ApiProperty()
  @IsString()
  @IsOptional()
  organizationId?: string;

  @ApiProperty()
  @IsString()
  @IsOptional()
  campaign?: string;

  @ApiProperty()
  @IsArray()
  @IsOptional()
  helpNeeds?: HelpNeed[];

  @ApiProperty()
  @IsString()
  @IsOptional()
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
  materialInsecurity?: CandidateYesNoValue;

  @ApiProperty()
  @IsString()
  @IsOptional()
  networkInsecurity?: CandidateYesNoValue;

  @ApiProperty()
  @IsString()
  @IsOptional()
  structure?: string;

  @ApiProperty()
  @IsString()
  @IsOptional()
  refererEmail?: string;

  @ApiProperty()
  @IsBoolean()
  @IsOptional()
  optInNewsletter?: boolean;

  // UTM

  @ApiProperty()
  @IsString()
  @IsOptional()
  utmSource?: string;

  @ApiProperty()
  @IsString()
  @IsOptional()
  utmMedium?: string;

  @ApiProperty()
  @IsString()
  @IsOptional()
  utmCampaign?: string;

  @ApiProperty()
  @IsString()
  @IsOptional()
  utmTerm?: string;

  @ApiProperty()
  @IsString()
  @IsOptional()
  utmContent?: string;

  @ApiProperty()
  @IsString()
  @IsOptional()
  utmId?: string;
}
