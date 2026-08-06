import {
  IsArray,
  IsEnum,
  IsNotEmpty,
  IsNumber,
  IsOptional,
  IsString,
  IsUUID,
} from 'class-validator';
import { Contracts } from 'src/contracts/contracts.types';
import type { Department } from 'src/locations/locations.types';
import { FilterConstant } from 'src/utils/types';

export class CreateRecruitementAlertDto {
  // Ignored server-side: the companyId is always derived from the
  // authenticated user to prevent creating/reassigning alerts for a
  // company the caller does not belong to.
  @IsUUID()
  @IsOptional()
  companyId?: string;

  @IsString()
  @IsNotEmpty()
  name: string;

  @IsString()
  @IsOptional()
  jobName?: string;

  @IsNumber()
  @IsOptional()
  workingExperienceYears?: number;

  @IsEnum(Contracts)
  @IsOptional()
  contractType?: Contracts;

  @IsArray()
  @IsUUID(4, { each: true })
  @IsOptional()
  businessSectorIds?: string[];

  @IsArray()
  @IsOptional()
  skills?: FilterConstant<string>[];

  @IsString()
  @IsOptional()
  department?: Department;
}
