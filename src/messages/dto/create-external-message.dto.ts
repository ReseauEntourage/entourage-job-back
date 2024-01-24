import { PickType } from '@nestjs/swagger';
import { ExternalMessage } from '../models';

export class CreateExternalMessageDto extends PickType(ExternalMessage, [
  'UserId',
  'senderFirstName',
  'senderLastName',
  'senderEmail',
  'senderPhone',
  'subject',
  'message',
  'type',
  'optInNewsletter',
] as const) {}
