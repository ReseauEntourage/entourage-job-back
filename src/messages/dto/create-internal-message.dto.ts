import { PickType } from '@nestjs/swagger';
import { InternalMessage } from '../models';

export class CreateInternalMessageDto extends PickType(InternalMessage, [
  'addresseeUserId',
  'subject',
  'message',
] as const) {}
