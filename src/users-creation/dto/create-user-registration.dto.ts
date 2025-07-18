import { ApiProperty, PickType } from '@nestjs/swagger';
import {
  IsArray,
  IsBoolean,
  IsNumber,
  IsOptional,
  IsString,
} from 'class-validator';
import { Department } from 'src/common/locations/locations.types';
import { Nudge } from 'src/common/nudge/models';
import {
  CandidateYesNoNSPPValue,
  CandidateYesNoValue,
} from 'src/contacts/contacts.types';
import { UserProfileSectorOccupation } from 'src/user-profiles/models';
import { User } from 'src/users/models';
import { Gender, RegistrableUserRole } from 'src/users/users.types';

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
  companyId?: string;

  @ApiProperty()
  @IsString()
  @IsOptional()
  companyRole?: string;

  @ApiProperty()
  @IsString()
  @IsOptional()
  campaign?: string;

  @ApiProperty()
  @IsArray()
  @IsOptional()
  nudges?: Nudge[];

  @ApiProperty()
  @IsString()
  @IsOptional()
  workingRight?: CandidateYesNoNSPPValue;

  @ApiProperty()
  @IsArray()
  @IsOptional()
  sectorOccupations?: UserProfileSectorOccupation[];

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
