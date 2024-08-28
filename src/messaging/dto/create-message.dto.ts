import { PickType } from '@nestjs/swagger';
import { Message } from '../models/';

export class CreateMessageDto extends PickType(Message, [
  'conversationId',
  'content',
] as const) {}
