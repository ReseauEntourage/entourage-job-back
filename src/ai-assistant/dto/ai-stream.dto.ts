import { ApiProperty } from '@nestjs/swagger';
import { IsNotEmpty, IsString, MaxLength } from 'class-validator';

export class AiStreamDto {
  @ApiProperty()
  @IsString()
  @IsNotEmpty()
  @MaxLength(12000)
  message: string;
}
