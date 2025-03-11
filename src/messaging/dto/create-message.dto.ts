import { ApiProperty, PickType } from '@nestjs/swagger';
import { IsArray, IsString, IsOptional, ArrayMaxSize } from 'class-validator';
import { Message } from '../models/';

export class CreateMessageDto extends PickType(Message, ['content'] as const) {
  @ApiProperty()
  @IsArray()
  @ArrayMaxSize(1)
  @IsOptional()
  participantIds?: string[];

  @ApiProperty()
  @IsString()
  conversationId?: string;

  @ApiProperty()
  @IsArray()
  @ArrayMaxSize(10)
  @IsOptional()
  files?: string[];
}
