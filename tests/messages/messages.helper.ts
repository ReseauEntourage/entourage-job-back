import { Injectable } from '@nestjs/common';
import {
  CreateExternalMessageDto,
  CreateInternalMessageDto,
} from 'src/messages/dto';
import { ExternalMessage, InternalMessage } from 'src/messages/models';

@Injectable()
export class MessagesHelper {
  mapExternalMessageProps(message: ExternalMessage): CreateExternalMessageDto {
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
  mapInternalMessageProps(message: InternalMessage): CreateInternalMessageDto {
    return {
      addresseeUserId: message.addresseeUserId,
      subject: message.subject,
      message: message.message,
    };
  }
}
