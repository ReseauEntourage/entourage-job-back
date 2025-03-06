import { ApiProperty } from '@nestjs/swagger';
import { IsBoolean, IsOptional, IsString } from 'class-validator';
import {
  CandidateAccommodation,
  CandidateResource,
  JobSearchDuration,
  Nationality,
  StudiesLevel,
  WorkingExperience,
  YesNoJNSPRValue,
} from 'src/contacts/contacts.types';

export class UpdateUserSocialSituationDto {
  @ApiProperty()
  @IsString()
  @IsOptional()
  materialInsecurity?: boolean;

  @ApiProperty()
  @IsString()
  @IsOptional()
  networkInsecurity?: boolean;

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

  @ApiProperty()
  @IsBoolean()
  @IsOptional()
  hasCompletedSurvey?: boolean;
}
