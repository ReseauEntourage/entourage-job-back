import { Injectable } from '@nestjs/common';
import { CreateExternalMessageDto } from 'src/external-messages/dto';
import { Message } from 'src/external-messages/models';

@Injectable()
export class ExternalMessagesHelper {
  mapMessageProps(message: Message): CreateExternalMessageDto {
    return {
      UserId: message.UserId,
      senderFirstName: message.senderFirstName,
      senderLastName: message.senderLastName,
      senderEmail: message.senderEmail,
      senderPhone: message.senderPhone,
      subject: message.subject,
      message: message.message,
      type: message.type,
    };
  }
}
