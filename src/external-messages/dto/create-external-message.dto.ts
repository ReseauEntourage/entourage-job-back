import { ApiProperty, PickType } from '@nestjs/swagger';
import { IsBoolean } from 'class-validator';
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
] as const) {
  @ApiProperty()
  @IsBoolean()
  optInContact: boolean;
}
