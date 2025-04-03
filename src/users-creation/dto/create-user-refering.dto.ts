import { ApiProperty, PickType } from '@nestjs/swagger';
import { IsArray, IsNumber, IsOptional, IsString } from 'class-validator';
import { Department } from 'src/common/locations/locations.types';
import { Occupation } from 'src/common/occupations/models';
import {
  CandidateYesNoNSPPValue,
  CandidateYesNoValue,
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
  businessSectorIds?: string[];

  @ApiProperty()
  @IsArray()
  @IsOptional()
  occupations?: Occupation[];

  @ApiProperty()
  @IsString()
  materialInsecurity: CandidateYesNoValue;

  @ApiProperty()
  @IsString()
  networkInsecurity: CandidateYesNoValue;
}
