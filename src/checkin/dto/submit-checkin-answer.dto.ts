import { ApiProperty } from '@nestjs/swagger';
import {
  IsArray,
  IsEnum,
  IsInt,
  IsOptional,
  IsString,
  Max,
  MaxLength,
  Min,
} from 'class-validator';
import {
  CheckinEmploymentType,
  CheckinExchangeFrequency,
  CheckinExchangeMode,
  CheckinPerceivedSupport,
  CheckinStillInTouch,
} from '../checkin.types';

// Each checkin step submits only the field(s) it owns — see CheckinService.submitAnswer,
// which persists whichever of these are present and rejects overwriting a field
// already answered.
export class SubmitCheckinAnswerDto {
  @ApiProperty({ enum: CheckinStillInTouch, required: false })
  @IsEnum(CheckinStillInTouch)
  @IsOptional()
  stillInTouch?: CheckinStillInTouch;

  @ApiProperty({ enum: CheckinExchangeMode, isArray: true, required: false })
  @IsArray()
  @IsEnum(CheckinExchangeMode, { each: true })
  @IsOptional()
  exchangeModes?: CheckinExchangeMode[];

  @ApiProperty({ enum: CheckinExchangeFrequency, required: false })
  @IsEnum(CheckinExchangeFrequency)
  @IsOptional()
  exchangeFrequency?: CheckinExchangeFrequency;

  // Validated loosely (string, not the role-specific enum) since the allowed set
  // depends on the responding user's role — the frontend only ever offers the
  // options valid for that role.
  @ApiProperty({ type: [String], required: false })
  @IsArray()
  @IsString({ each: true })
  @IsOptional()
  perceivedBenefits?: string[];

  @ApiProperty({ enum: CheckinEmploymentType, required: false })
  @IsEnum(CheckinEmploymentType)
  @IsOptional()
  employmentType?: CheckinEmploymentType;

  @ApiProperty({ enum: CheckinPerceivedSupport, required: false })
  @IsEnum(CheckinPerceivedSupport)
  @IsOptional()
  perceivedSupport?: CheckinPerceivedSupport;

  @ApiProperty({ required: false })
  @IsInt()
  @Min(1)
  @Max(5)
  @IsOptional()
  rating?: number;

  @ApiProperty({ required: false })
  @IsString()
  @MaxLength(2000)
  @IsOptional()
  comment?: string;
}
