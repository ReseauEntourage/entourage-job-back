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

export class CreateRecruitementAlertDto {
  @IsString()
  @IsNotEmpty()
  name: string;

  @IsString()
  @IsNotEmpty()
  jobName: string;

  @IsNumber()
  @IsOptional()
  workingExperienceYears?: number;

  @IsEnum(Contracts)
  @IsOptional()
  contractType?: Contracts;

  @IsUUID()
  @IsNotEmpty()
  companyId: string;

  @IsArray()
  @IsUUID(4, { each: true })
  @IsOptional()
  businessSectorIds?: string[];

  @IsArray()
  @IsUUID(4, { each: true })
  @IsOptional()
  skillIds?: string[];
}
