import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import { Transform } from 'class-transformer';
import { IsEnum, IsOptional, IsString, MaxLength } from 'class-validator';
import { REPORT_COMMENT_MAX_LENGTH, ReportReasons } from '../reports.types';

// The length is checked after trimming
const trim = ({ value }: { value: unknown }) =>
  typeof value === 'string' ? value.trim() : value;

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
  @Transform(trim)
  @IsString()
  @MaxLength(REPORT_COMMENT_MAX_LENGTH)
  comment?: string;
}
