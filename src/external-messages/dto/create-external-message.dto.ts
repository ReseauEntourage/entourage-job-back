import { PickType } from '@nestjs/swagger';
import { Message } from '../models';

export class CreateExternalMessageDto extends PickType(Message, [
  'UserId',
  'senderFirstName',
  'senderLastName',
  'senderEmail',
  'senderPhone',
  'subject',
  'message',
  'type',
] as const) {}
