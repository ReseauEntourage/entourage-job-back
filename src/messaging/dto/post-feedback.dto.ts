import { ApiProperty } from '@nestjs/swagger';
import { IsNumber, IsString, IsUUID } from 'class-validator';

export class PostFeedbackDto {
  @ApiProperty()
  @IsString()
  @IsUUID(4)
  conversationParticipantId: string;

  @ApiProperty()
  @IsNumber()
  rating: number | null;
}
