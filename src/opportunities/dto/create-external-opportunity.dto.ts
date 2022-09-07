import { ApiProperty } from '@nestjs/swagger';
import {
  IsBoolean,
  IsDate,
  IsOptional,
  IsString,
  IsUUID,
} from 'class-validator';
import { BusinessLineValue } from 'src/businessLines/businessLines.types';
import { ContractValue } from 'src/contracts/contracts.types';
import { Department } from 'src/locations/locations.types';
import {
  ExternalOfferOrigin,
  OfferStatus,
} from 'src/opportunities/opportunities.types';

export class CreateExternalOpportunityDto {
  @ApiProperty()
  @IsUUID()
  candidateId: string;

  @ApiProperty()
  @IsOptional()
  @IsString()
  status: OfferStatus;

  @ApiProperty()
  @IsString()
  title: string;

  @ApiProperty()
  @IsString()
  company: string;

  @ApiProperty()
  @IsString()
  contract: ContractValue;

  @ApiProperty()
  @IsOptional()
  @IsDate()
  startOfContract: Date;

  @ApiProperty()
  @IsOptional()
  @IsDate()
  endOfContract: Date;

  @ApiProperty()
  @IsOptional()
  @IsBoolean()
  isPartTime: boolean;

  @ApiProperty()
  @IsOptional()
  @IsString()
  businessLines: BusinessLineValue;

  @ApiProperty()
  @IsString()
  department: Department;

  @ApiProperty()
  @IsOptional()
  @IsString()
  link: ContractValue;

  @ApiProperty()
  @IsOptional()
  @IsString()
  description: string;

  @ApiProperty()
  @IsOptional()
  @IsString()
  externalOrigin: ExternalOfferOrigin;

  @ApiProperty()
  @IsDate()
  date: Date;
}
