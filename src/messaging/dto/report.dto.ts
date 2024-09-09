import { ApiProperty } from '@nestjs/swagger';
import { IsString } from 'class-validator';

export class ReportDto {
  @ApiProperty()
  @IsString()
  reason: string;

  @ApiProperty()
  @IsString()
  comment: string;
}
