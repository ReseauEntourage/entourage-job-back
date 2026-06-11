import { Transform, Type } from 'class-transformer';
import {
  IsArray,
  IsBoolean,
  IsEnum,
  IsIn,
  IsInt,
  IsOptional,
  IsString,
  IsUUID,
  Max,
  MaxLength,
  Min,
} from 'class-validator';
import { EventMode, EventPublicAudience, EventType } from '../event.types';

const toArray = ({ value }: { value: unknown }) =>
  Array.isArray(value) ? value : value !== undefined ? [value] : undefined;

export class FindAllEventsQueryDto {
  @IsOptional()
  @IsInt()
  @Min(1)
  @Max(200)
  @Type(() => Number)
  limit?: number = 50;

  @IsOptional()
  @IsInt()
  @Min(0)
  @Type(() => Number)
  offset?: number = 0;

  @IsOptional()
  @IsBoolean()
  @Type(() => Boolean)
  includePastEvents?: boolean = false;

  @IsOptional()
  @IsString()
  @MaxLength(200)
  search?: string;

  @IsOptional()
  @IsArray()
  @IsEnum(EventMode, { each: true })
  @Transform(toArray)
  modes?: EventMode[];

  @IsOptional()
  @IsArray()
  @IsEnum(EventType, { each: true })
  @Transform(toArray)
  eventTypes?: EventType[];

  @IsOptional()
  @IsArray()
  @IsUUID(4, { each: true })
  @Transform(toArray)
  departmentIds?: string[];

  @IsOptional()
  @IsIn(['true', 'false'])
  isParticipating?: string;

  @IsOptional()
  @IsArray()
  @IsEnum(EventPublicAudience, { each: true })
  @Transform(toArray)
  publicSensibilise?: EventPublicAudience[];
}
