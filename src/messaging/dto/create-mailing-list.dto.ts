import { ApiProperty, PickType } from '@nestjs/swagger';
import { IsArray, ArrayMinSize, ArrayMaxSize, IsEmail } from 'class-validator';
import { Message } from '../models/';

export class CreateMailingListDto extends PickType(Message, [
  'content',
] as const) {
  @ApiProperty()
  @IsArray()
  @IsEmail({}, { each: true })
  @ArrayMinSize(1)
  @ArrayMaxSize(500)
  recipientEmails: string[];
}
