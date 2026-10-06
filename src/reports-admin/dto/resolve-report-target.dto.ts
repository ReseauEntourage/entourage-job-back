import { ApiPropertyOptional } from '@nestjs/swagger';
import { Transform } from 'class-transformer';
import { IsOptional, IsString, MaxLength } from 'class-validator';
import { REPORT_RESOLUTION_NOTE_MAX_LENGTH } from '../reports-admin.types';
import { trimString } from 'src/utils/transforms';

export class ResolveReportTargetDto {
  @ApiPropertyOptional()
  @IsOptional()
  @Transform(trimString)
  @IsString()
  @MaxLength(REPORT_RESOLUTION_NOTE_MAX_LENGTH)
  note?: string;
}
