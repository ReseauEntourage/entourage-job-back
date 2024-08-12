import { ApiProperty } from '@nestjs/swagger';
import { IsArray, MaxLength, MinLength } from 'class-validator';

export class CreateConversationDto {
  @ApiProperty()
  @IsArray()
  @MinLength(1)
  @MaxLength(1) // Only one to one conversations are supported at the moment
  participantIds: string[];
}
