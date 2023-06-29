import { PickType } from '@nestjs/swagger';
import { Message } from '../models';

export class CreateMessageDto extends PickType(Message, [
  'UserId',
  'firstName',
  'lastName',
  'email',
  'phone',
  'subject',
  'message',
  'type',
] as const) {}
