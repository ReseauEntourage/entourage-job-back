import { Injectable } from '@nestjs/common';
import { CreateExternalMessageDto } from 'src/external-messages/dto';
import { ExternalMessage } from 'src/external-messages/models';

@Injectable()
export class ExternalMessagesHelper {
  mapMessageProps(message: ExternalMessage): CreateExternalMessageDto {
    return {
      UserId: message.UserId,
      senderFirstName: message.senderFirstName,
      senderLastName: message.senderLastName,
      senderEmail: message.senderEmail,
      senderPhone: message.senderPhone,
      subject: message.subject,
      message: message.message,
      type: message.type,
      optInNewsletter: message.optInNewsletter,
    };
  }
}
