import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import { Transform } from 'class-transformer';
import { IsEnum, IsOptional, IsString, MaxLength } from 'class-validator';
import { REPORT_COMMENT_MAX_LENGTH, ReportReasons } from '../reports.types';
import { trimString } from 'src/utils/transforms';

/**
 * Contract shared by the conversation and profile reports: a motive among
 * the shared list and an optional comment.
 */
export class ReportContentDto {
  @ApiProperty({ enum: Object.values(ReportReasons) })
  @IsEnum(ReportReasons)
  reason: (typeof ReportReasons)[keyof typeof ReportReasons];

  @ApiPropertyOptional()
  @IsOptional()
  @Transform(trimString)
  @IsString()
  @MaxLength(REPORT_COMMENT_MAX_LENGTH)
  comment?: string;
}
