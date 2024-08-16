import { ApiProperty } from '@nestjs/swagger';
import { IsString } from 'class-validator';

export class ReportAbuseUserProfileDto {
  @ApiProperty()
  @IsString()
  reason: string;

  @ApiProperty()
  @IsString()
  comment: string;
}
