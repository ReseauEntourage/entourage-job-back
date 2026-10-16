import { ApiPropertyOptional } from '@nestjs/swagger';
import { IsEnum, IsIn, IsOptional, IsString } from 'class-validator';
import type {
  ReportTargetFilter,
  ReportTargetStatus,
} from '../reports-admin.types';
import {
  ReportTargetFilters,
  ReportTargetStatuses,
} from '../reports-admin.types';
import { ZoneName } from 'src/utils/types/zones.types';

export class ReportTargetsQueryDto {
  @ApiPropertyOptional({ enum: Object.values(ReportTargetFilters) })
  @IsOptional()
  @IsIn(Object.values(ReportTargetFilters))
  type?: ReportTargetFilter;

  @ApiPropertyOptional({ enum: Object.values(ReportTargetStatuses) })
  @IsOptional()
  @IsIn(Object.values(ReportTargetStatuses))
  status?: ReportTargetStatus;

  @ApiPropertyOptional({ enum: ZoneName })
  @IsOptional()
  @IsEnum(ZoneName)
  zone?: ZoneName;

  @ApiPropertyOptional()
  @IsOptional()
  @IsString()
  cursor?: string;
}

export class ReportsPendingCountQueryDto {
  @ApiPropertyOptional({ enum: ZoneName })
  @IsOptional()
  @IsEnum(ZoneName)
  zone?: ZoneName;
}
