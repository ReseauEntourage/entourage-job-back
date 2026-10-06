import { ApiPropertyOptional } from '@nestjs/swagger';
import { Transform } from 'class-transformer';
import { IsOptional, IsString, MaxLength } from 'class-validator';
import { REPORT_RESOLUTION_NOTE_MAX_LENGTH } from '../reports-admin.types';

// The length is checked after trimming
const trim = ({ value }: { value: unknown }) =>
  typeof value === 'string' ? value.trim() : value;

export class ResolveReportTargetDto {
  @ApiPropertyOptional()
  @IsOptional()
  @Transform(trim)
  @IsString()
  @MaxLength(REPORT_RESOLUTION_NOTE_MAX_LENGTH)
  note?: string;
}
