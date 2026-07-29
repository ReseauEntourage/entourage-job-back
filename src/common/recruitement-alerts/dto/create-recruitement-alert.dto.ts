import {
  IsArray,
  IsEnum,
  IsNotEmpty,
  IsNumber,
  IsOptional,
  IsString,
  IsUUID,
} from 'class-validator';
import type { Department } from 'src/common/locations/locations.types';
import { Contracts } from 'src/contracts/contracts.types';
import { FilterConstant } from 'src/utils/types';

export class CreateRecruitementAlertDto {
  @IsUUID()
  @IsNotEmpty()
  companyId: string;

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
