import {
  IsArray,
  IsEnum,
  IsNotEmpty,
  IsNumber,
  IsOptional,
  IsString,
  IsUUID,
} from 'class-validator';
import { Contracts } from 'src/common/contracts/contracts.types';
import { FilterConstant } from 'src/utils/types';

export class CreateRecruitementAlertDto {
  @IsUUID()
  @IsNotEmpty()
  companyId: string;

  @IsString()
  @IsNotEmpty()
  name: string;

  @IsString()
  @IsNotEmpty()
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
}
