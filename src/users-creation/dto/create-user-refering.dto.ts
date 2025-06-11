import { ApiProperty, PickType } from '@nestjs/swagger';
import { IsArray, IsNumber, IsOptional, IsString } from 'class-validator';
import { Department } from 'src/common/locations/locations.types';
import { Nudge } from 'src/common/nudge/models';
import {
  CandidateYesNoNSPPValue,
  CandidateYesNoValue,
} from 'src/contacts/contacts.types';
import { UserProfileSectorOccupation } from 'src/user-profiles/models';
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
  @IsOptional()
  nudges?: Nudge[];

  @ApiProperty()
  @IsString()
  workingRight?: CandidateYesNoNSPPValue;

  @ApiProperty()
  @IsArray()
  @IsOptional()
  sectorOccupations?: UserProfileSectorOccupation[];

  @ApiProperty()
  @IsString()
  materialInsecurity: CandidateYesNoValue;

  @ApiProperty()
  @IsString()
  networkInsecurity: CandidateYesNoValue;
}
